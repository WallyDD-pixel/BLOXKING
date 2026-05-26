-- Matchmaking v2 : file FIFO stable, tranche ELO élargie dans le temps, SKIP LOCKED,
-- rate limiting RPC, léger jitter, cooldown court après clôture (apply_elo).

-- --- Journal RPC (rate limit, pas d’accès client) ---
create table if not exists public.matchmaking_rpc_log (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_matchmaking_rpc_log_user_time
  on public.matchmaking_rpc_log (user_id, created_at desc);

alter table public.matchmaking_rpc_log enable row level security;

revoke all on public.matchmaking_rpc_log from public;
revoke all on public.matchmaking_rpc_log from anon, authenticated;

-- --- File : premier entré + snapshot ELO figé à la 1re mise en file ---
alter table public.match_queue
  add column if not exists first_queued_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists elo_snapshot int not null default 1000,
  add column if not exists placement_snapshot int not null default 0;

update public.match_queue
set
  first_queued_at = coalesce(first_queued_at, created_at),
  last_seen_at = coalesce(last_seen_at, created_at)
where first_queued_at is null or last_seen_at is null;

alter table public.match_queue alter column first_queued_at set default now();
alter table public.match_queue alter column last_seen_at set default now();
alter table public.match_queue alter column first_queued_at set not null;
alter table public.match_queue alter column last_seen_at set not null;

alter table public.match_queue drop constraint if exists match_queue_elo_snapshot_chk;
alter table public.match_queue
  add constraint match_queue_elo_snapshot_chk
  check (elo_snapshot >= 100 and elo_snapshot <= 4000);

alter table public.match_queue drop constraint if exists match_queue_placement_snapshot_chk;
alter table public.match_queue
  add constraint match_queue_placement_snapshot_chk
  check (placement_snapshot >= 0 and placement_snapshot <= 5);

create index if not exists idx_match_queue_first_queued
  on public.match_queue (first_queued_at asc, user_id asc);

-- --- Cooldown re-file après match confirmé ---
alter table public.player_ranked_stats
  add column if not exists queue_available_after timestamptz;

comment on column public.player_ranked_stats.queue_available_after is
  'Tant que now() < cette valeur, join_ranked_queue est refusé (anti-spam / dodge léger).';

-- --- apply_elo : pose le cooldown ---
create or replace function public.apply_elo_after_match_confirm(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  pa uuid;
  pb uuid;
  ma int;
  mb int;
  ra int;
  rb int;
  ra0 int;
  rb0 int;
  pa_pl int;
  pb_pl int;
  ka int;
  kb int;
  ea numeric;
  eb numeric;
  sa numeric;
  sb numeric;
  a_wins boolean;
  dra int;
  drb int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.status <> 'confirmed' then
    return;
  end if;
  if m.elo_processed then
    return;
  end if;

  pa := m.player_a;
  pb := m.player_b;
  ma := m.claim_from_a_maps_a;
  mb := m.claim_from_a_maps_b;

  if ma is null or mb is null then
    return;
  end if;

  insert into public.player_ranked_stats (user_id, elo, placement_matches_played)
  values (pa, 1000, 0)
  on conflict (user_id) do nothing;
  insert into public.player_ranked_stats (user_id, elo, placement_matches_played)
  values (pb, 1000, 0)
  on conflict (user_id) do nothing;

  select elo, placement_matches_played into ra, pa_pl
  from public.player_ranked_stats where user_id = pa;
  select elo, placement_matches_played into rb, pb_pl
  from public.player_ranked_stats where user_id = pb;

  ra0 := ra;
  rb0 := rb;

  a_wins := ma > mb;
  sa := case when a_wins then 1.0 else 0.0 end;
  sb := 1.0 - sa;

  ea := 1.0 / (1.0 + power(10::numeric, (rb - ra) / 400.0));
  eb := 1.0 / (1.0 + power(10::numeric, (ra - rb) / 400.0));

  ka := case when pa_pl < 5 then 40 else 20 end;
  kb := case when pb_pl < 5 then 40 else 20 end;

  dra := round(ka * (sa - ea))::int;
  drb := round(kb * (sb - eb))::int;

  ra := greatest(100, least(4000, ra + dra));
  rb := greatest(100, least(4000, rb + drb));

  update public.player_ranked_stats
  set
    elo = ra,
    placement_matches_played = least(5, pa_pl + 1),
    updated_at = now(),
    queue_available_after = now() + interval '12 seconds'
  where user_id = pa;

  update public.player_ranked_stats
  set
    elo = rb,
    placement_matches_played = least(5, pb_pl + 1),
    updated_at = now(),
    queue_available_after = now() + interval '12 seconds'
  where user_id = pb;

  update public.matches
  set
    elo_processed = true,
    elo_delta_a = ra - ra0,
    elo_delta_b = rb - rb0
  where id = p_match_id;
end;
$$;

-- --- join_ranked_queue v2 ---
create or replace function public.join_ranked_queue(queue_ctx jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  partner uuid;
  new_id uuid;
  pa uuid;
  pb uuid;
  v_elo int;
  v_pl int;
  v_first timestamptz;
  v_my_elo int;
  v_my_pl int;
  v_wait_sec numeric;
  v_span int;
  v_cnt int;
  v_cooldown timestamptz;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  -- Jitter léger (anti-scripts synchronisés à la seconde)
  perform pg_sleep(random() * 0.04);

  select s.queue_available_after into v_cooldown
  from public.player_ranked_stats s
  where s.user_id = uid;

  if v_cooldown is not null and v_cooldown > now() then
    return jsonb_build_object(
      'error', 'queue_cooldown',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (v_cooldown - now())))::int)
    );
  end if;

  if public.user_has_open_ranked_match(uid) then
    return jsonb_build_object('error', 'active_match_in_progress');
  end if;

  select count(*)::int into v_cnt
  from public.matchmaking_rpc_log l
  where l.user_id = uid
    and l.created_at > now() - interval '1 minute';

  -- ~30 appels/min par onglet (polling 2 s) ; marge double onglet + retries
  if v_cnt >= 72 then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  insert into public.matchmaking_rpc_log (user_id) values (uid);

  delete from public.matchmaking_rpc_log
  where ctid in (
    select ctid from public.matchmaking_rpc_log
    where created_at < now() - interval '3 hours'
    limit 8000
  );

  select p.elo, p.placement_matches_played
  into v_elo, v_pl
  from public.player_ranked_stats p
  where p.user_id = uid;

  if not found then
    v_elo := 1000;
    v_pl := 0;
  end if;

  insert into public.match_queue (
    user_id,
    created_at,
    first_queued_at,
    last_seen_at,
    elo_snapshot,
    placement_snapshot
  )
  values (uid, now(), now(), now(), v_elo, v_pl)
  on conflict (user_id) do update set
    created_at = excluded.created_at,
    last_seen_at = now();

  select
    mq.first_queued_at,
    mq.elo_snapshot,
    mq.placement_snapshot
  into v_first, v_my_elo, v_my_pl
  from public.match_queue mq
  where mq.user_id = uid;

  v_wait_sec := extract(epoch from (now() - v_first));
  if v_wait_sec < 0 then
    v_wait_sec := 0;
  end if;

  -- Base ±50 LP, +25 toutes les 15 s d’attente, max ±800
  v_span := least(800, 50 + (floor(v_wait_sec / 15)::int * 25));

  select mq.user_id into partner
  from public.match_queue mq
  where mq.user_id <> uid
    and not public.user_has_open_ranked_match(mq.user_id)
    and abs(mq.elo_snapshot - v_my_elo) <= v_span
    and (
      (v_my_pl < 5 and mq.placement_snapshot < 5)
      or (v_my_pl >= 5 and mq.placement_snapshot >= 5)
    )
  order by mq.first_queued_at asc, mq.user_id asc
  limit 1
  for update skip locked;

  if partner is null then
    return jsonb_build_object('matched', false);
  end if;

  if public.user_has_open_ranked_match(partner) then
    delete from public.match_queue where user_id = partner;
    return jsonb_build_object('matched', false);
  end if;

  delete from public.match_queue where user_id in (uid, partner);

  if uid::text < partner::text then
    pa := uid;
    pb := partner;
  else
    pa := partner;
    pb := uid;
  end if;

  insert into public.matches (player_a, player_b, source, status)
  values (pa, pb, 'queue', 'pending')
  returning id into new_id;

  return jsonb_build_object(
    'matched', true,
    'match_id', new_id,
    'opponent_id', partner
  );
end;
$$;

grant execute on function public.join_ranked_queue(jsonb) to authenticated;

notify pgrst, 'reload schema';
