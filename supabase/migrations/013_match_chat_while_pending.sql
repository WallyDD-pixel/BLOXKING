-- Chat joueur–joueur dès le match en pending (pas seulement en litige).
-- Conserver l’historique du chat quand on réinitialise après litige.

create or replace function public.match_post_dispute_chat_message(
  p_match_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t text := trim(coalesce(p_body, ''));
  new_id uuid;
begin
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
      and (m.player_a = uid or m.player_b = uid)
      and m.status in ('pending', 'disputed')
  ) then
    return jsonb_build_object('error', 'dispute_chat_forbidden');
  end if;

  insert into public.match_dispute_chat_messages (match_id, author_id, body)
  values (p_match_id, uid, t)
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
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
  n int;
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

  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('error', 'no_active_dispute_or_forbidden');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

notify pgrst, 'reload schema';
