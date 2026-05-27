-- Admin : colonne is_admin + fonctions de modération (exécuter après db/00_auth.sql).

alter table public.users
  add column if not exists is_admin boolean not null default false;

create index if not exists idx_users_is_admin on public.users (is_admin)
  where is_admin = true;

create or replace function public.assert_app_user_is_admin()
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
  select coalesce(is_admin, false) into ok from public.users where id = uid;
  if not ok then
    raise exception 'forbidden';
  end if;
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
begin
  perform public.assert_app_user_is_admin();

  if not public.is_valid_bo3_maps(p_maps_a, p_maps_b) then
    return jsonb_build_object('error', 'invalid_bo3_score');
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
    status = 'confirmed'
  where id = p_match_id
    and status in ('pending', 'disputed');

  if not found then
    return jsonb_build_object('error', 'not_found_or_closed');
  end if;

  perform public.apply_elo_after_match_confirm(p_match_id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_cancel_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_app_user_is_admin();

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
  where id = p_match_id
    and status in ('pending', 'disputed');

  if not found then
    return jsonb_build_object('error', 'not_found_or_closed');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_reset_match_dispute(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_app_user_is_admin();

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
    and status in ('pending', 'disputed');

  if not found then
    return jsonb_build_object('error', 'not_found_or_closed');
  end if;

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
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  t text := trim(coalesce(p_body, ''));
  new_id uuid;
begin
  perform public.assert_app_user_is_admin();

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
  ) then
    return jsonb_build_object('error', 'not_found');
  end if;

  insert into public.match_dispute_chat_messages (match_id, author_id, body)
  values (p_match_id, uid, t)
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

grant execute on function public.admin_resolve_match(uuid, int, int) to public;
grant execute on function public.admin_cancel_match(uuid) to public;
grant execute on function public.admin_reset_match_dispute(uuid) to public;
grant execute on function public.admin_post_dispute_chat_message(uuid, text) to public;
