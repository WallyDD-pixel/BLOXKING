-- Demandes d'annulation par les joueurs (salle PVP → modération admin).
-- psql -U bloxking -d bloxking -h localhost -f db/07_match_cancellation_requests.sql

create table if not exists public.match_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  requested_by uuid not null references public.users (id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  constraint match_cancel_reason_len check (
    char_length(trim(reason)) >= 10 and char_length(reason) <= 2000
  )
);

create unique index if not exists idx_match_cancel_req_open_user
  on public.match_cancellation_requests (match_id, requested_by)
  where status = 'open';

create index if not exists idx_match_cancel_req_match
  on public.match_cancellation_requests (match_id, created_at desc);

create or replace function public.match_request_cancellation(
  p_match_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  exp text := trim(coalesce(p_reason, ''));
  updated int;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if char_length(exp) < 10 then
    return jsonb_build_object('error', 'cancellation_reason_too_short');
  end if;
  if char_length(exp) > 2000 then
    return jsonb_build_object('error', 'cancellation_reason_too_long');
  end if;

  if not exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and (m.player_a = uid or m.player_b = uid)
      and m.status in ('pending', 'disputed')
  ) then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  update public.match_cancellation_requests
  set reason = exp, created_at = now()
  where match_id = p_match_id
    and requested_by = uid
    and status = 'open';

  get diagnostics updated = row_count;

  if updated = 0 then
    insert into public.match_cancellation_requests (match_id, requested_by, reason)
    values (p_match_id, uid, exp);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_cancel_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  has_player_request boolean;
begin
  perform public.assert_app_user_is_admin();

  select exists (
    select 1
    from public.match_cancellation_requests r
    where r.match_id = p_match_id
      and r.status = 'open'
  )
  into has_player_request;

  update public.open_challenges oc
  set status = 'open', opponent_id = null
  where oc.id in (
    select m.challenge_id
    from public.matches m
    where m.id = p_match_id
      and m.challenge_id is not null
  )
  and oc.status = 'matched';

  update public.match_cancellation_requests
  set status = 'closed'
  where match_id = p_match_id
    and status = 'open';

  update public.matches
  set
    status = 'cancelled',
    cancel_reason = case when has_player_request then 'player_request' else 'admin' end,
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
    and status in ('pending', 'disputed');

  if not found then
    return jsonb_build_object('error', 'not_found_or_closed');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.match_request_cancellation(uuid, text) to public;
grant execute on function public.admin_cancel_match(uuid) to public;
