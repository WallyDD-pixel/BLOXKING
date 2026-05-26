-- Clôture du match dès que les deux déclarations BO3 concordent (sans validation croisée).

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

  update public.matches
  set status = 'confirmed'
  where id = p_match_id;

  return jsonb_build_object('ok', true);
end;
$$;

notify pgrst, 'reload schema';
