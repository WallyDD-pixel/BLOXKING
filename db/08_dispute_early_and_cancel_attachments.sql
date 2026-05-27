-- Litige sans score déclaré + pièces jointes sur demandes d'annulation.
-- psql -U bloxking -d bloxking -h localhost -f db/08_dispute_early_and_cancel_attachments.sql

drop function if exists public.match_request_cancellation(uuid, text);

alter table public.match_cancellation_requests
  add column if not exists attachment_paths text[] not null default '{}';

create or replace function public.match_request_cancellation(
  p_match_id uuid,
  p_reason text,
  p_attachment_paths text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  exp text := trim(coalesce(p_reason, ''));
  paths text[] := coalesce(p_attachment_paths, '{}');
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

  if not public.match_dispute_paths_valid(paths, p_match_id, uid) then
    return jsonb_build_object('error', 'invalid_attachment_paths');
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
  set
    reason = exp,
    attachment_paths = paths,
    created_at = now()
  where match_id = p_match_id
    and requested_by = uid
    and status = 'open';

  get diagnostics updated = row_count;

  if updated = 0 then
    insert into public.match_cancellation_requests (
      match_id,
      requested_by,
      reason,
      attachment_paths
    )
    values (p_match_id, uid, exp, paths);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.match_submit_dispute_ticket(
  p_match_id uuid,
  p_explanation text,
  p_attachment_paths text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (nullif(current_setting('app.user_id', true), '')::uuid);
  exp text := trim(coalesce(p_explanation, ''));
  t text;
  n int;
  in_dispute boolean;
  rec public.matches%rowtype;
  my_a int;
  my_b int;
  opp_a int;
  opp_b int;
  header text;
  paths text[] := coalesce(p_attachment_paths, '{}');
  any_claim boolean;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if char_length(exp) < 10 then
    return jsonb_build_object('error', 'ticket_body_too_short');
  end if;
  if char_length(exp) > 2000 then
    return jsonb_build_object('error', 'ticket_body_too_long');
  end if;

  if not public.match_dispute_paths_valid(paths, p_match_id, uid) then
    return jsonb_build_object('error', 'invalid_attachment_paths');
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

  select * into rec from public.matches where id = p_match_id;
  if not found then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  in_dispute := coalesce(rec.dispute, false);

  if in_dispute then
    t := exp;
    insert into public.match_dispute_tickets (match_id, opened_by, body, attachment_paths)
    values (p_match_id, uid, t, paths);
    return jsonb_build_object('ok', true, 'follow_up', true);
  end if;

  if rec.player_a = uid then
    my_a := rec.claim_from_a_maps_a;
    my_b := rec.claim_from_a_maps_b;
    opp_a := rec.claim_from_b_maps_a;
    opp_b := rec.claim_from_b_maps_b;
  else
    my_a := rec.claim_from_b_maps_a;
    my_b := rec.claim_from_b_maps_b;
    opp_a := rec.claim_from_a_maps_a;
    opp_b := rec.claim_from_a_maps_b;
  end if;

  any_claim := my_a is not null or my_b is not null or opp_a is not null or opp_b is not null;

  if any_claim then
    header :=
      '[Résumé automatique — scores déclarés, perspective globale A vs B]' || E'\n' ||
      'Ton score déclaré (A — B) : ' ||
      coalesce(my_a::text, '—') || ' — ' || coalesce(my_b::text, '—') || E'\n' ||
      'Score déclaré par l''adversaire (A — B) : ' ||
      coalesce(opp_a::text, '—') || ' — ' || coalesce(opp_b::text, '—') || E'\n' ||
      E'\n---' || E'\n' ||
      'Pourquoi tu estimes avoir raison (et pas l''autre joueur) :' || E'\n';
  else
    header :=
      '[Litige ouvert — aucun score BO3 déclaré pour l''instant]' || E'\n' ||
      'Ton score déclaré (A — B) : — — —' || E'\n' ||
      'Score déclaré par l''adversaire (A — B) : — — —' || E'\n' ||
      E'\n---' || E'\n' ||
      'Situation / ce que tu signales à la modération :' || E'\n';
  end if;

  t := header || exp;

  if char_length(t) > 4000 then
    return jsonb_build_object('error', 'ticket_body_too_long');
  end if;

  update public.matches
  set
    dispute = true,
    manual_dispute = true,
    status = 'disputed'
  where id = p_match_id
    and (player_a = uid or player_b = uid)
    and status in ('pending', 'disputed');

  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  insert into public.match_dispute_tickets (match_id, opened_by, body, attachment_paths)
  values (p_match_id, uid, t, paths);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.match_request_cancellation(uuid, text, text[]) to public;
