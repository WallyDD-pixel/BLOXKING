-- Flux rencontre BO3 : démarrage mutuel, saisie des scores, validations croisées, litige.

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
  add column if not exists player_b_roblox text;

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
  uid uuid := auth.uid();
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
  uid uuid := auth.uid();
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
  uid uuid := auth.uid();
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
  uid uuid := auth.uid();
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
  uid uuid := auth.uid();
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

  if not found then
    return jsonb_build_object('error', 'no_active_dispute_or_forbidden');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.match_finalize(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
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
  if not r.b_accepts_a_claim or not r.a_accepts_b_claim then
    return jsonb_build_object('error', 'acceptances_incomplete');
  end if;

  update public.matches
  set status = 'confirmed'
  where id = p_match_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.is_valid_bo3_maps(int, int) to authenticated;
grant execute on function public.match_confirm_started(uuid) to authenticated;
grant execute on function public.match_submit_score_claim(uuid, int, int) to authenticated;
grant execute on function public.match_accept_opponent_claim(uuid) to authenticated;
grant execute on function public.match_declare_dispute(uuid) to authenticated;
grant execute on function public.match_reset_after_dispute(uuid) to authenticated;
grant execute on function public.match_finalize(uuid) to authenticated;

notify pgrst, 'reload schema';
