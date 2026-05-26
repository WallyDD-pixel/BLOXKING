-- Empêcher toute nouvelle soumission de score une fois que les deux déclarations concordent.

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

  if r.claim_from_a_maps_a is not null
     and r.claim_from_b_maps_a is not null
     and r.claim_from_a_maps_a = r.claim_from_b_maps_a
     and r.claim_from_a_maps_b = r.claim_from_b_maps_b
     and not r.dispute
  then
    return jsonb_build_object('error', 'claims_consensus_locked');
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

notify pgrst, 'reload schema';
