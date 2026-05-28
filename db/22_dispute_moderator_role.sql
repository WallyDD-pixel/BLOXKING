-- Modérateur litiges : accès admin limité (vue d’ensemble, matchs, litiges — pas utilisateurs).

alter table public.users
  add column if not exists is_dispute_moderator boolean not null default false;

create index if not exists idx_users_dispute_moderator
  on public.users (is_dispute_moderator)
  where is_dispute_moderator = true;

create or replace function public.assert_app_user_is_dispute_staff()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  ok boolean;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  select coalesce(is_admin, false) or coalesce(is_dispute_moderator, false)
  into ok
  from public.users
  where id = uid;
  if not coalesce(ok, false) then
    raise exception 'forbidden';
  end if;
end;
$$;

grant execute on function public.assert_app_user_is_dispute_staff() to public;

-- Litiges : admin complet OU modérateur litiges
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
  perform public.assert_app_user_is_dispute_staff();

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
  perform public.assert_app_user_is_dispute_staff();

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
  perform public.assert_app_user_is_dispute_staff();

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

create or replace function public.admin_post_dispute_chat_message(
  p_match_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  t text := trim(coalesce(p_body, ''));
  new_id uuid;
begin
  perform public.assert_app_user_is_dispute_staff();

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
    select 1 from public.matches m where m.id = p_match_id
  ) then
    return jsonb_build_object('error', 'not_found');
  end if;

  insert into public.match_dispute_chat_messages (match_id, author_id, body)
  values (p_match_id, uid, t)
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

create or replace function public.admin_apply_player_blame(
  p_user_id uuid,
  p_match_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_fair_wins int := 2;
begin
  perform public.assert_app_user_is_dispute_staff();

  if not exists (select 1 from public.users where id = p_user_id) then
    return jsonb_build_object('error', 'user_not_found');
  end if;

  if public.user_is_banned(p_user_id) then
    return jsonb_build_object('error', 'user_banned');
  end if;

  insert into public.player_ranked_stats (user_id, elo, placement_matches_played)
  values (p_user_id, 1000, 0)
  on conflict (user_id) do nothing;

  update public.player_ranked_stats
  set
    blame_active = true,
    blame_fair_wins_required = v_fair_wins,
    blame_fair_wins_done = 0,
    blame_count = blame_count + 1,
    blame_note = nullif(trim(p_note), ''),
    blame_match_id = p_match_id,
    blame_applied_at = now(),
    updated_at = now()
  where user_id = p_user_id;

  insert into public.player_moderation_events (user_id, admin_id, match_id, kind, note)
  values (p_user_id, uid, p_match_id, 'blame_applied', nullif(trim(p_note), ''));

  return jsonb_build_object('ok', true, 'fair_wins_required', v_fair_wins);
end;
$$;

create or replace function public.admin_clear_player_blame(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
begin
  perform public.assert_app_user_is_dispute_staff();

  if not exists (select 1 from public.users where id = p_user_id) then
    return jsonb_build_object('error', 'user_not_found');
  end if;

  update public.player_ranked_stats
  set
    blame_active = false,
    blame_fair_wins_required = 0,
    blame_fair_wins_done = 0,
    blame_note = null,
    blame_match_id = null,
    blame_applied_at = null,
    updated_at = now()
  where user_id = p_user_id;

  insert into public.player_moderation_events (user_id, admin_id, kind, note)
  values (p_user_id, uid, 'blame_cleared', 'levé manuellement par modération');

  return jsonb_build_object('ok', true);
end;
$$;
