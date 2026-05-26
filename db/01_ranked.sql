-- BLOXKING ranked (PostgreSQL local, sans Supabase)
-- Prérequis: db/00_auth.sql
-- psql -U bloxking -d bloxking -h localhost -f db/01_ranked.sql

create table if not exists public.open_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users (id) on delete cascade,
  creator_display_name text,
  opponent_id uuid references public.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'matched', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references public.users (id) on delete cascade,
  player_b uuid not null references public.users (id) on delete cascade,
  player_a_label text,
  player_b_label text,
  source text not null check (source in ('challenge', 'queue')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'disputed', 'cancelled')),
  challenge_id uuid references public.open_challenges (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint player_order check (player_a <> player_b)
);

create table if not exists public.match_queue (
  user_id uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  first_queued_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  elo_snapshot int not null default 1000
    check (elo_snapshot >= 100 and elo_snapshot <= 4000),
  placement_snapshot int not null default 0
    check (placement_snapshot >= 0 and placement_snapshot <= 5)
);

create index if not exists idx_match_queue_first_queued
  on public.match_queue (first_queued_at asc, user_id asc);

-- Journal RPC matchmaking (rate limit ; pas d’accès PostgREST pour les joueurs)
create table if not exists public.matchmaking_rpc_log (
  id bigserial primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_matchmaking_rpc_log_user_time
  on public.matchmaking_rpc_log (user_id, created_at desc);



create index if not exists idx_open_challenges_status on public.open_challenges (status);
create index if not exists idx_matches_players on public.matches (player_a, player_b);

create table if not exists public.player_ranked_stats (
  user_id uuid primary key references public.users (id) on delete cascade,
  elo int not null default 1000
    check (elo >= 100 and elo <= 4000),
  placement_matches_played int not null default 0
    check (placement_matches_played >= 0 and placement_matches_played <= 5),
  updated_at timestamptz not null default now(),
  queue_available_after timestamptz
);

create index if not exists idx_player_ranked_stats_elo
  on public.player_ranked_stats (elo desc);










-- --- Match actif unique + tickets litige ---
create or replace function public.user_has_open_ranked_match(p_uid uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where (m.player_a = p_uid or m.player_b = p_uid)
      and m.status in ('pending', 'disputed')
  );
$$;

create table if not exists public.match_dispute_tickets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  opened_by uuid not null references public.users (id) on delete cascade,
  body text not null,
  attachment_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint match_dispute_tickets_body_len check (
    char_length(trim(body)) >= 10
    and char_length(body) <= 4000
  ),
  constraint match_dispute_tickets_attachment_paths_card check (
    cardinality(coalesce(attachment_paths, '{}')) <= 5
  )
);

create index if not exists idx_match_dispute_tickets_match_id
  on public.match_dispute_tickets (match_id desc);







create or replace function public.match_dispute_paths_valid(
  p_paths text[],
  p_match_id uuid,
  p_uid uuid
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  p text;
  parts text[];
  n int;
begin
  n := cardinality(coalesce(p_paths, '{}'));
  if n > 5 then
    return false;
  end if;
  if n = 0 then
    return true;
  end if;
  foreach p in array coalesce(p_paths, '{}')
  loop
    parts := string_to_array(p, '/');
    if array_length(parts, 1) is distinct from 4 then
      return false;
    end if;
    if parts[1] is distinct from 'dispute' then
      return false;
    end if;
    if parts[2] is distinct from p_match_id::text then
      return false;
    end if;
    if parts[3] is distinct from p_uid::text then
      return false;
    end if;
    if parts[4] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp)$' then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.match_submit_dispute_ticket(
  p_match_id uuid,
  p_explanation text,
  p_attachment_paths text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  exp text := trim(coalesce(p_explanation, ''));
  t text;
  n int;
  in_dispute boolean;
  rec public.matches%rowtype;
  my_a int;
  my_b int;
  opp_a int;
  opp_b int;
  header text;
  paths text[] := coalesce(p_attachment_paths, '{}');
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if char_length(exp) < 10 then
    return jsonb_build_object('error', 'ticket_body_too_short');
  end if;
  if char_length(exp) > 2000 then
    return jsonb_build_object('error', 'ticket_body_too_long');
  end if;

  if not public.match_dispute_paths_valid(paths, p_match_id, uid) then
    return jsonb_build_object('error', 'invalid_attachment_paths');
  end if;

  if not exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and (m.player_a = uid or m.player_b = uid)
      and m.status <> 'confirmed'
  ) then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  select * into rec from public.matches where id = p_match_id;
  if not found then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  in_dispute := coalesce(rec.dispute, false);

  if in_dispute then
    t := exp;
    insert into public.match_dispute_tickets (match_id, opened_by, body, attachment_paths)
    values (p_match_id, uid, t, paths);
    return jsonb_build_object('ok', true, 'follow_up', true);
  end if;

  if rec.player_a = uid then
    my_a := rec.claim_from_a_maps_a;
    my_b := rec.claim_from_a_maps_b;
    opp_a := rec.claim_from_b_maps_a;
    opp_b := rec.claim_from_b_maps_b;
  else
    my_a := rec.claim_from_b_maps_a;
    my_b := rec.claim_from_b_maps_b;
    opp_a := rec.claim_from_a_maps_a;
    opp_b := rec.claim_from_a_maps_b;
  end if;

  header :=
    '[Résumé automatique — scores déclarés, perspective globale A vs B]' || E'\n' ||
    'Ton score déclaré (A — B) : ' ||
    coalesce(my_a::text, '—') || ' — ' || coalesce(my_b::text, '—') || E'\n' ||
    'Score déclaré par l''adversaire (A — B) : ' ||
    coalesce(opp_a::text, '—') || ' — ' || coalesce(opp_b::text, '—') || E'\n' ||
    E'\n---' || E'\n' ||
    'Pourquoi tu estimes avoir raison (et pas l''autre joueur) :' || E'\n';

  t := header || exp;

  if char_length(t) > 4000 then
    return jsonb_build_object('error', 'ticket_body_too_long');
  end if;

  update public.matches
  set
    dispute = true,
    manual_dispute = true,
    status = 'disputed'
  where id = p_match_id
    and (player_a = uid or player_b = uid)
    and status <> 'confirmed';

  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  insert into public.match_dispute_tickets (match_id, opened_by, body, attachment_paths)
  values (p_match_id, uid, t, paths);

  return jsonb_build_object('ok', true);
end;
$$;

-- Chat joueurs pendant litige (push_notification_sent_at : futur worker notifications).
create table if not exists public.match_dispute_chat_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  push_notification_sent_at timestamptz,
  constraint match_dispute_chat_body_len check (
    char_length(trim(body)) >= 1
    and char_length(body) <= 2000
  )
);

create index if not exists idx_match_dispute_chat_match_created
  on public.match_dispute_chat_messages (match_id, created_at asc);




create or replace function public.match_post_dispute_chat_message(
  p_match_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  t text := trim(coalesce(p_body, ''));
  new_id uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if char_length(t) < 1 then
    return jsonb_build_object('error', 'chat_body_too_short');
  end if;
  if char_length(t) > 2000 then
    return jsonb_build_object('error', 'chat_body_too_long');
  end if;

  if not exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and (m.player_a = uid or m.player_b = uid)
      and m.status in ('pending', 'disputed')
  ) then
    return jsonb_build_object('error', 'dispute_chat_forbidden');
  end if;

  insert into public.match_dispute_chat_messages (match_id, author_id, body)
  values (p_match_id, uid, t)
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;



drop function if exists public.join_ranked_queue();
drop function if exists public.join_ranked_queue(jsonb);

create or replace function public.join_ranked_queue(queue_ctx jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
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
    delete from match_queue where user_id = partner;
    return jsonb_build_object('matched', false);
  end if;

  delete from match_queue where user_id in (uid, partner);

  if uid::text < partner::text then
    pa := uid;
    pb := partner;
  else
    pa := partner;
    pb := uid;
  end if;

  insert into matches (player_a, player_b, source, status)
  values (pa, pb, 'queue', 'pending')
  returning id into new_id;

  return jsonb_build_object(
    'matched', true,
    'match_id', new_id,
    'opponent_id', partner
  );
end;
$$;

grant execute on function public.join_ranked_queue(jsonb) to public;

create or replace function public.accept_open_challenge(challenge_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  c record;
  new_match uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if public.user_has_open_ranked_match(uid) then
    return jsonb_build_object('error', 'active_match_in_progress');
  end if;

  select * into c
  from open_challenges
  where id = challenge_uuid
  for update;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if c.status <> 'open' then
    return jsonb_build_object('error', 'not_open');
  end if;
  if c.creator_id = uid then
    return jsonb_build_object('error', 'cannot_accept_own');
  end if;

  if public.user_has_open_ranked_match(c.creator_id) then
    return jsonb_build_object('error', 'challenger_has_active_match');
  end if;

  update open_challenges
  set opponent_id = uid, status = 'matched'
  where id = challenge_uuid;

  insert into matches (player_a, player_b, source, status, challenge_id)
  values (
    least(c.creator_id, uid),
    greatest(c.creator_id, uid),
    'challenge',
    'pending',
    challenge_uuid
  )
  returning id into new_match;

  return jsonb_build_object('ok', true, 'match_id', new_match);
end;
$$;

grant execute on function public.accept_open_challenge(uuid) to public;

-- --- Rencontre BO3 (même contenu que migrations/005_match_score_flow.sql) ---
alter table public.matches
  add column if not exists match_started_a boolean not null default false,
  add column if not exists match_started_b boolean not null default false,
  add column if not exists claim_from_a_maps_a smallint,
  add column if not exists claim_from_a_maps_b smallint,
  add column if not exists claim_from_b_maps_a smallint,
  add column if not exists claim_from_b_maps_b smallint,
  add column if not exists b_accepts_a_claim boolean not null default false,
  add column if not exists a_accepts_b_claim boolean not null default false,
  add column if not exists dispute boolean not null default false,
  add column if not exists manual_dispute boolean not null default false,
  add column if not exists player_a_roblox text,
  add column if not exists player_b_roblox text,
  add column if not exists elo_processed boolean not null default false,
  add column if not exists elo_delta_a smallint,
  add column if not exists elo_delta_b smallint;

-- Score BO3 valide : premier à 2 manches (2-0, 2-1, 1-2, 0-2)
create or replace function public.is_valid_bo3_maps(ma int, mb int)
returns boolean
language sql
immutable
as $$
  select ma >= 0 and mb >= 0 and ma <= 2 and mb <= 2
    and greatest(ma, mb) = 2
    and ma + mb <= 3;
$$;

create or replace function public.match_sync_dispute_from_claims(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.matches%rowtype;
begin
  select * into r from public.matches where id = p_id for update;
  if not found then
    return;
  end if;

  if r.claim_from_a_maps_a is not null and r.claim_from_b_maps_a is not null then
    if r.claim_from_a_maps_a = r.claim_from_b_maps_a
       and r.claim_from_a_maps_b = r.claim_from_b_maps_b then
      update public.matches
      set
        dispute = case when r.manual_dispute then true else false end,
        status = case
          when r.manual_dispute then status
          when status = 'disputed'::text then 'pending'::text
          else status
        end
      where id = p_id;
    else
      update public.matches
      set dispute = true,
          manual_dispute = false,
          status = 'disputed'
      where id = p_id;
    end if;
  end if;
end;
$$;

create or replace function public.match_confirm_started(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  update public.matches
  set
    match_started_a = case when player_a = uid then true else match_started_a end,
    match_started_b = case when player_b = uid then true else match_started_b end
  where id = p_match_id
    and (player_a = uid or player_b = uid);

  if not found then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.match_submit_score_claim(
  p_match_id uuid,
  p_maps_won_a int,
  p_maps_won_b int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  r public.matches%rowtype;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if not public.is_valid_bo3_maps(p_maps_won_a, p_maps_won_b) then
    return jsonb_build_object('error', 'invalid_bo3_score');
  end if;

  select * into r from public.matches where id = p_match_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if r.player_a <> uid and r.player_b <> uid then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if r.status = 'confirmed' then
    return jsonb_build_object('error', 'match_already_finished');
  end if;

  if r.claim_from_a_maps_a is not null
     and r.claim_from_b_maps_a is not null
     and r.claim_from_a_maps_a = r.claim_from_b_maps_a
     and r.claim_from_a_maps_b = r.claim_from_b_maps_b
     and not r.dispute
  then
    return jsonb_build_object('error', 'claims_consensus_locked');
  end if;

  if r.player_a = uid then
    update public.matches
    set
      claim_from_a_maps_a = p_maps_won_a,
      claim_from_a_maps_b = p_maps_won_b,
      b_accepts_a_claim = false,
      manual_dispute = false
    where id = p_match_id;
  else
    update public.matches
    set
      claim_from_b_maps_a = p_maps_won_a,
      claim_from_b_maps_b = p_maps_won_b,
      a_accepts_b_claim = false,
      manual_dispute = false
    where id = p_match_id;
  end if;

  perform public.match_sync_dispute_from_claims(p_match_id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.match_accept_opponent_claim(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  r public.matches%rowtype;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select * into r from public.matches where id = p_match_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if r.player_a <> uid and r.player_b <> uid then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if r.status = 'confirmed' then
    return jsonb_build_object('error', 'match_already_finished');
  end if;

  -- B accepte la déclaration de A
  if uid = r.player_b then
    if r.claim_from_a_maps_a is null then
      return jsonb_build_object('error', 'opponent_claim_missing');
    end if;
    update public.matches set b_accepts_a_claim = true where id = p_match_id;
  elsif uid = r.player_a then
    if r.claim_from_b_maps_a is null then
      return jsonb_build_object('error', 'opponent_claim_missing');
    end if;
    update public.matches set a_accepts_b_claim = true where id = p_match_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.match_declare_dispute(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  update public.matches
  set dispute = true,
      manual_dispute = true,
      status = 'disputed'
  where id = p_match_id
    and (player_a = uid or player_b = uid)
    and status <> 'confirmed';

  if not found then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.match_reset_after_dispute(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  n int;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  update public.matches
  set
    claim_from_a_maps_a = null,
    claim_from_a_maps_b = null,
    claim_from_b_maps_a = null,
    claim_from_b_maps_b = null,
    b_accepts_a_claim = false,
    a_accepts_b_claim = false,
    dispute = false,
    manual_dispute = false,
    status = 'pending'
  where id = p_match_id
    and (player_a = uid or player_b = uid)
    and dispute = true;

  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('error', 'no_active_dispute_or_forbidden');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Litige + ticket : après 30 min sans résolution (toujours en disputed), annulation auto du match.
create or replace function public.expire_disputed_matches_after_ticket_timeout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  delete from public.match_dispute_chat_messages c
  using public.matches m
  inner join (
    select match_id, min(created_at) as first_at
    from public.match_dispute_tickets
    group by match_id
  ) ft on ft.match_id = m.id
  where c.match_id = m.id
    and m.status = 'disputed'
    and m.dispute = true
    and ft.first_at < now() - interval '30 minutes';

  with first_ticket as (
    select match_id, min(created_at) as first_at
    from public.match_dispute_tickets
    group by match_id
  ),
  due as (
    select m.id
    from public.matches m
    inner join first_ticket ft on ft.match_id = m.id
    where m.status = 'disputed'
      and m.dispute = true
      and ft.first_at < now() - interval '30 minutes'
  )
  update public.matches m
  set
    status = 'cancelled',
    dispute = false,
    manual_dispute = false,
    claim_from_a_maps_a = null,
    claim_from_a_maps_b = null,
    claim_from_b_maps_a = null,
    claim_from_b_maps_b = null,
    b_accepts_a_claim = false,
    a_accepts_b_claim = false,
    match_started_a = false,
    match_started_b = false
  from due
  where m.id = due.id;

  get diagnostics n = row_count;
  return jsonb_build_object('cancelled', n);
end;
$$;

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

create or replace function public.match_finalize(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  r public.matches%rowtype;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select * into r from public.matches where id = p_match_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if r.player_a <> uid and r.player_b <> uid then
    return jsonb_build_object('error', 'forbidden');
  end if;

  if r.status = 'confirmed' then
    return jsonb_build_object('error', 'match_already_finished');
  end if;

  if not r.match_started_a or not r.match_started_b then
    return jsonb_build_object('error', 'match_not_started_by_both');
  end if;
  if r.dispute then
    return jsonb_build_object('error', 'dispute_open');
  end if;
  if r.claim_from_a_maps_a is null or r.claim_from_b_maps_a is null then
    return jsonb_build_object('error', 'claims_incomplete');
  end if;
  if r.claim_from_a_maps_a <> r.claim_from_b_maps_a
     or r.claim_from_a_maps_b <> r.claim_from_b_maps_b then
    return jsonb_build_object('error', 'claims_differ');
  end if;

  update public.matches
  set status = 'confirmed'
  where id = p_match_id;

  perform public.apply_elo_after_match_confirm(p_match_id);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.is_valid_bo3_maps(int, int) to public;
grant execute on function public.match_confirm_started(uuid) to public;
grant execute on function public.match_submit_score_claim(uuid, int, int) to public;
grant execute on function public.match_accept_opponent_claim(uuid) to public;
grant execute on function public.match_declare_dispute(uuid) to public;
grant execute on function public.match_submit_dispute_ticket(uuid, text, text[]) to public;
grant execute on function public.match_reset_after_dispute(uuid) to public;
grant execute on function public.match_finalize(uuid) to public;
grant execute on function public.match_post_dispute_chat_message(uuid, text) to public;
grant execute on function public.expire_disputed_matches_after_ticket_timeout() to public;
grant execute on function public.expire_disputed_matches_after_ticket_timeout() to public;

-- Réparation : recalcule elo_delta_a/b pour l’historique (matchs confirmés déjà traités).
-- Exécution manuelle (SQL Editor, rôle service) : select public.repair_match_elo_delta_columns();
create or replace function public.repair_match_elo_delta_columns()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
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
  ma int;
  mb int;
  updated int := 0;
begin
  create temp table _elo_sim (
    user_id uuid primary key,
    elo int not null default 1000,
    pl int not null default 0
  ) on commit drop;

  for m in
    select *
    from public.matches
    where status = 'confirmed'
      and coalesce(elo_processed, false) = true
    order by created_at asc
  loop
    ma := m.claim_from_a_maps_a;
    mb := m.claim_from_a_maps_b;
    if ma is null or mb is null then
      continue;
    end if;

    insert into _elo_sim (user_id) values (m.player_a) on conflict (user_id) do nothing;
    insert into _elo_sim (user_id) values (m.player_b) on conflict (user_id) do nothing;

    select elo, pl into ra, pa_pl from _elo_sim where user_id = m.player_a;
    select elo, pl into rb, pb_pl from _elo_sim where user_id = m.player_b;

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

    update public.matches
    set
      elo_delta_a = ra - ra0,
      elo_delta_b = rb - rb0
    where id = m.id;

    updated := updated + 1;

    update _elo_sim
    set
      elo = ra,
      pl = least(5, pl + 1)
    where user_id = m.player_a;

    update _elo_sim
    set
      elo = rb,
      pl = least(5, pl + 1)
    where user_id = m.player_b;
  end loop;

  return jsonb_build_object('ok', true, 'matches_replayed', updated);
end;
$$;

revoke all on function public.repair_match_elo_delta_columns() from public;
grant execute on function public.repair_match_elo_delta_columns() to public;

