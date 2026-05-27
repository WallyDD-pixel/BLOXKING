-- Historique des décisions admin sur les litiges + correction après clôture.

create table if not exists public.match_dispute_admin_decisions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  admin_id uuid not null references public.users (id) on delete restrict,
  action text not null check (
    action in ('resolve', 'cancel', 'reset_dispute')
  ),
  maps_a int,
  maps_b int,
  previous_status text not null,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dispute_admin_decisions_match
  on public.match_dispute_admin_decisions (match_id, created_at desc);

grant select, insert on public.match_dispute_admin_decisions to bloxking;

create or replace function public.record_dispute_admin_decision(
  p_match_id uuid,
  p_admin_id uuid,
  p_action text,
  p_maps_a int,
  p_maps_b int,
  p_previous_status text,
  p_new_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.match_dispute_admin_decisions (
    match_id,
    admin_id,
    action,
    maps_a,
    maps_b,
    previous_status,
    new_status,
    note
  )
  values (
    p_match_id,
    p_admin_id,
    p_action,
    p_maps_a,
    p_maps_b,
    p_previous_status,
    p_new_status,
    p_note
  );
end;
$$;

create or replace function public.reverse_elo_for_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
begin
  select * into m
  from public.matches
  where id = p_match_id
  for update;

  if not found or not coalesce(m.elo_processed, false) then
    return;
  end if;

  if m.elo_delta_a is not null then
    update public.player_ranked_stats
    set
      elo = greatest(100, least(4000, elo - m.elo_delta_a)),
      placement_matches_played = greatest(0, placement_matches_played - 1),
      updated_at = now()
    where user_id = m.player_a;
  end if;

  if m.elo_delta_b is not null then
    update public.player_ranked_stats
    set
      elo = greatest(100, least(4000, elo - m.elo_delta_b)),
      placement_matches_played = greatest(0, placement_matches_played - 1),
      updated_at = now()
    where user_id = m.player_b;
  end if;

  update public.matches
  set
    elo_processed = false,
    elo_delta_a = null,
    elo_delta_b = null
  where id = p_match_id;
end;
$$;

create or replace function public.admin_resolve_match(
  p_match_id uuid,
  p_maps_a int,
  p_maps_b int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_prev text;
  v_processed boolean;
begin
  perform public.assert_app_user_is_admin();

  if not public.is_valid_bo3_maps(p_maps_a, p_maps_b) then
    return jsonb_build_object('error', 'invalid_bo3_score');
  end if;

  select m.status, coalesce(m.elo_processed, false)
  into v_prev, v_processed
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not_found_or_closed');
  end if;

  if v_prev not in ('pending', 'disputed', 'confirmed', 'cancelled') then
    return jsonb_build_object('error', 'not_found_or_closed');
  end if;

  if v_prev = 'confirmed' and v_processed then
    perform public.reverse_elo_for_match(p_match_id);
  end if;

  update public.matches
  set
    claim_from_a_maps_a = p_maps_a,
    claim_from_a_maps_b = p_maps_b,
    claim_from_b_maps_a = p_maps_a,
    claim_from_b_maps_b = p_maps_b,
    match_started_a = true,
    match_started_b = true,
    b_accepts_a_claim = true,
    a_accepts_b_claim = true,
    dispute = false,
    manual_dispute = false,
    status = 'confirmed',
    cancel_reason = null
  where id = p_match_id;

  perform public.apply_elo_after_match_confirm(p_match_id);

  perform public.record_dispute_admin_decision(
    p_match_id,
    uid,
    'resolve',
    p_maps_a,
    p_maps_b,
    v_prev,
    'confirmed',
    case
      when v_prev in ('confirmed', 'cancelled') then 'Correction après clôture'
      else null
    end
  );

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
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_prev text;
  v_processed boolean;
begin
  perform public.assert_app_user_is_admin();

  select m.status, coalesce(m.elo_processed, false)
  into v_prev, v_processed
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not_found_or_closed');
  end if;

  if v_prev not in ('pending', 'disputed', 'confirmed', 'cancelled') then
    return jsonb_build_object('error', 'not_found_or_closed');
  end if;

  if v_prev = 'confirmed' and v_processed then
    perform public.reverse_elo_for_match(p_match_id);
  end if;

  update public.matches
  set
    status = 'cancelled',
    dispute = false,
    manual_dispute = false,
    claim_from_a_maps_a = null,
    claim_from_a_maps_b = null,
    claim_from_b_maps_a = null,
    claim_from_b_maps_b = null,
    b_accepts_a_claim = false,
    a_accepts_b_claim = false
  where id = p_match_id;

  perform public.record_dispute_admin_decision(
    p_match_id,
    uid,
    'cancel',
    null,
    null,
    v_prev,
    'cancelled',
    case
      when v_prev = 'confirmed' then 'Annulation après validation du score'
      else null
    end
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_reset_match_dispute(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_prev text;
begin
  perform public.assert_app_user_is_admin();

  select m.status into v_prev
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not_found_or_closed');
  end if;

  if v_prev not in ('pending', 'disputed') then
    return jsonb_build_object('error', 'not_found_or_closed');
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
  where id = p_match_id;

  perform public.record_dispute_admin_decision(
    p_match_id,
    uid,
    'reset_dispute',
    null,
    null,
    v_prev,
    'pending',
    null
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.record_dispute_admin_decision(uuid, uuid, text, int, int, text, text, text) to public;
grant execute on function public.reverse_elo_for_match(uuid) to public;
