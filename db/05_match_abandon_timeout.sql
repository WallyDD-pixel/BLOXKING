-- Match pending sans litige depuis 25 min → annulé (abandon).
-- psql -U bloxking -d bloxking -h localhost -f db/05_match_abandon_timeout.sql

create or replace function public.expire_pending_matches_after_abandon_timeout()
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
    and m.created_at < now() - interval '25 minutes';

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
    cancel_reason = 'abandoned',
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

grant execute on function public.expire_pending_matches_after_abandon_timeout() to public;
