-- Esquive début de match (2 min) : 3x contre le même adversaire → avertissement ;
-- 4e fois → défaite automatique 2-0 + ELO.

create table if not exists public.player_opponent_start_dodges (
  user_id uuid not null references public.users (id) on delete cascade,
  opponent_id uuid not null references public.users (id) on delete cascade,
  dodge_count int not null default 0 check (dodge_count >= 0),
  last_dodge_at timestamptz not null default now(),
  primary key (user_id, opponent_id),
  constraint start_dodge_not_self check (user_id <> opponent_id)
);

create index if not exists idx_start_dodges_opponent
  on public.player_opponent_start_dodges (user_id, dodge_count desc);

create or replace function public.get_start_dodge_count(
  p_user_id uuid,
  p_opponent_id uuid
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select d.dodge_count
      from public.player_opponent_start_dodges d
      where d.user_id = p_user_id
        and d.opponent_id = p_opponent_id
    ),
    0
  );
$$;

create or replace function public.record_start_dodge(
  p_dodger_id uuid,
  p_opponent_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_dodger_id is null or p_opponent_id is null or p_dodger_id = p_opponent_id then
    return 0;
  end if;

  insert into public.player_opponent_start_dodges (
    user_id,
    opponent_id,
    dodge_count,
    last_dodge_at
  )
  values (p_dodger_id, p_opponent_id, 1, now())
  on conflict (user_id, opponent_id) do update
  set
    dodge_count = public.player_opponent_start_dodges.dodge_count + 1,
    last_dodge_at = now()
  returning dodge_count into v_count;

  return v_count;
end;
$$;

create or replace function public.apply_start_dodge_forfeit(
  p_match_id uuid,
  p_loser_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  v_winner uuid;
  v_maps_a int;
  v_maps_b int;
begin
  select * into m
  from public.matches
  where id = p_match_id
  for update;

  if not found or m.status <> 'pending' then
    return;
  end if;

  if p_loser_id <> m.player_a and p_loser_id <> m.player_b then
    return;
  end if;

  v_winner := case
    when m.player_a = p_loser_id then m.player_b
    else m.player_a
  end;

  if v_winner = m.player_a then
    v_maps_a := 2;
    v_maps_b := 0;
  else
    v_maps_a := 0;
    v_maps_b := 2;
  end if;

  update public.open_challenges oc
  set status = 'open', opponent_id = null
  where oc.id = m.challenge_id
    and oc.status = 'matched';

  update public.matches
  set
    status = 'confirmed',
    cancel_reason = 'dodge_forfeit',
    dispute = false,
    manual_dispute = false,
    match_started_a = true,
    match_started_b = true,
    claim_from_a_maps_a = v_maps_a,
    claim_from_a_maps_b = v_maps_b,
    claim_from_b_maps_a = v_maps_a,
    claim_from_b_maps_b = v_maps_b,
    b_accepts_a_claim = true,
    a_accepts_b_claim = true
  where id = p_match_id;

  perform public.apply_elo_after_match_confirm(p_match_id);
end;
$$;

create or replace function public.cancel_match_start_timeout(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.open_challenges oc
  set status = 'open', opponent_id = null
  where oc.id = (
    select m.challenge_id from public.matches m where m.id = p_match_id
  )
  and oc.status = 'matched';

  update public.matches
  set
    status = 'cancelled',
    cancel_reason = 'start_timeout',
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
  where id = p_match_id
    and status = 'pending';
end;
$$;

create or replace function public.expire_pending_matches_after_start_timeout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_cancelled int := 0;
  n_forfeit int := 0;
  rec record;
  v_dodger uuid;
  v_opponent uuid;
  v_count_a int;
  v_count_b int;
  v_loser uuid;
begin
  for rec in
    select
      m.id,
      m.player_a,
      m.player_b,
      coalesce(m.match_started_a, false) as started_a,
      coalesce(m.match_started_b, false) as started_b
    from public.matches m
    where m.status = 'pending'
      and coalesce(m.dispute, false) = false
      and not (coalesce(m.match_started_a, false) and coalesce(m.match_started_b, false))
      and m.created_at < now() - interval '2 minutes'
    for update of m skip locked
  loop
    if not rec.started_a and not rec.started_b then
      v_count_a := public.get_start_dodge_count(rec.player_a, rec.player_b);
      v_count_b := public.get_start_dodge_count(rec.player_b, rec.player_a);

      if v_count_a >= 3 then
        v_loser := rec.player_a;
      elsif v_count_b >= 3 then
        v_loser := rec.player_b;
      else
        v_loser := null;
      end if;

      if v_loser is not null then
        perform public.apply_start_dodge_forfeit(rec.id, v_loser);
        perform public.record_start_dodge(v_loser, case when v_loser = rec.player_a then rec.player_b else rec.player_a end);
        n_forfeit := n_forfeit + 1;
      else
        perform public.record_start_dodge(rec.player_a, rec.player_b);
        perform public.record_start_dodge(rec.player_b, rec.player_a);
        perform public.cancel_match_start_timeout(rec.id);
        n_cancelled := n_cancelled + 1;
      end if;

      continue;
    end if;

    if not rec.started_a then
      v_dodger := rec.player_a;
      v_opponent := rec.player_b;
    else
      v_dodger := rec.player_b;
      v_opponent := rec.player_a;
    end if;

    if public.get_start_dodge_count(v_dodger, v_opponent) >= 3 then
      perform public.apply_start_dodge_forfeit(rec.id, v_dodger);
      perform public.record_start_dodge(v_dodger, v_opponent);
      n_forfeit := n_forfeit + 1;
    else
      perform public.record_start_dodge(v_dodger, v_opponent);
      perform public.cancel_match_start_timeout(rec.id);
      n_cancelled := n_cancelled + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'cancelled', n_cancelled,
    'forfeit', n_forfeit
  );
end;
$$;

grant select on public.player_opponent_start_dodges to bloxking;
grant execute on function public.get_start_dodge_count(uuid, uuid) to public;
grant execute on function public.record_start_dodge(uuid, uuid) to public;
grant execute on function public.apply_start_dodge_forfeit(uuid, uuid) to public;
grant execute on function public.cancel_match_start_timeout(uuid) to public;
grant execute on function public.expire_pending_matches_after_start_timeout() to public;
