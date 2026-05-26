-- Si un litige avec au moins un ticket modération reste ouvert 30 min après le *premier* ticket,
-- le match est annulé automatiquement (status cancelled, sans ELO) pour débloquer les joueurs.
--
-- Optionnel (pg_cron, si activé sur le projet) :
--   select cron.schedule(
--     'expire-dispute-timeouts',
--     '*/5 * * * *',
--     $$ select public.expire_disputed_matches_after_ticket_timeout(); $$
--   );

create or replace function public.expire_disputed_matches_after_ticket_timeout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
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

grant execute on function public.expire_disputed_matches_after_ticket_timeout() to authenticated;
grant execute on function public.expire_disputed_matches_after_ticket_timeout() to service_role;

notify pgrst, 'reload schema';
