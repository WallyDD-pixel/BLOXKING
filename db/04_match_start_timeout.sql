-- Délai pour confirmer le début du match (les deux joueurs) avant annulation auto.
-- psql -U bloxking -d bloxking -h localhost -f db/04_match_start_timeout.sql

alter table public.matches
  add column if not exists cancel_reason text;

create or replace function public.expire_pending_matches_after_start_timeout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  due_ids uuid[];
begin
  select coalesce(array_agg(m.id), '{}')
  into due_ids
  from public.matches m
  where m.status = 'pending'
    and coalesce(m.dispute, false) = false
    and not (m.match_started_a and m.match_started_b)
    and m.created_at < now() - interval '2 minutes';

  if cardinality(due_ids) = 0 then
    return jsonb_build_object('cancelled', 0);
  end if;

  update public.open_challenges oc
  set status = 'open', opponent_id = null
  where oc.id in (
    select m.challenge_id
    from public.matches m
    where m.id = any(due_ids)
      and m.challenge_id is not null
  )
  and oc.status = 'matched';

  update public.matches m
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
  where m.id = any(due_ids);

  get diagnostics n = row_count;
  return jsonb_build_object('cancelled', n);
end;
$$;

-- Met à jour la raison d’annulation pour les litiges expirés (30 min).
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
    cancel_reason = 'dispute_timeout',
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

create or replace function public.match_confirm_started(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  st text;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  perform public.expire_pending_matches_after_start_timeout();

  select status into st
  from public.matches
  where id = p_match_id
    and (player_a = uid or player_b = uid);

  if not found then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  if st = 'cancelled' then
    return jsonb_build_object('error', 'match_start_deadline_passed');
  end if;

  if st <> 'pending' then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  update public.matches
  set
    match_started_a = case when player_a = uid then true else match_started_a end,
    match_started_b = case when player_b = uid then true else match_started_b end
  where id = p_match_id
    and (player_a = uid or player_b = uid);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.expire_pending_matches_after_start_timeout() to public;
grant execute on function public.expire_disputed_matches_after_ticket_timeout() to public;
grant execute on function public.match_confirm_started(uuid) to public;
