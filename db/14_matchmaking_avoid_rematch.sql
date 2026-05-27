-- Évite de retomber trop souvent sur le même adversaire (24 h, pénalité au jumelage).

create index if not exists idx_matches_queue_recent_a
  on public.matches (player_a, created_at desc)
  where source = 'queue';

create index if not exists idx_matches_queue_recent_b
  on public.matches (player_b, created_at desc)
  where source = 'queue';

create or replace function public.matchmaking_rematch_penalty(p_uid uuid, p_opp uuid)
returns int
language sql
stable
as $$
  with recent as (
    select count(*)::int as c, max(m.created_at) as last_at
    from public.matches m
    where m.source = 'queue'
      and m.created_at > now() - interval '24 hours'
      and (
        (m.player_a = p_uid and m.player_b = p_opp)
        or (m.player_a = p_opp and m.player_b = p_uid)
      )
  )
  select
    coalesce((select c from recent), 0) * 90
    + case
        when (select last_at from recent) > now() - interval '30 minutes' then 110
        when (select last_at from recent) > now() - interval '2 hours' then 55
        else 0
      end
    + case
        when (select last_at from recent) > now() - interval '20 minutes' then 400
        when coalesce((select c from recent), 0) >= 2
          and (select last_at from recent) > now() - interval '3 hours' then 250
        else 0
      end;
$$;

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
    and abs(mq.elo_snapshot - v_my_elo) <= (
      v_span
      + public.matchmaking_placement_uncertainty(v_my_pl)
      + public.matchmaking_placement_uncertainty(mq.placement_snapshot)
    )
  order by
    abs(mq.elo_snapshot - v_my_elo)
    + case
        when (v_my_pl >= 5) <> (mq.placement_snapshot >= 5) then 55
        else 0
      end
    + public.matchmaking_rematch_penalty(uid, mq.user_id),
    mq.first_queued_at asc,
    mq.user_id asc
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

grant execute on function public.matchmaking_rematch_penalty(uuid, uuid) to public;
grant execute on function public.join_ranked_queue(jsonb) to public;
