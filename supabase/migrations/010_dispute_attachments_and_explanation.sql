-- Pièces jointes litige (Storage) + corps du ticket = résumé auto (scores) + explication joueur.
-- Nouvelle signature RPC : (match_id, explanation, attachment_paths).

alter table public.match_dispute_tickets
  drop constraint if exists match_dispute_tickets_body_len;

alter table public.match_dispute_tickets
  add constraint match_dispute_tickets_body_len check (
    char_length(trim(body)) >= 10
    and char_length(body) <= 4000
  );

alter table public.match_dispute_tickets
  add column if not exists attachment_paths text[] not null default '{}';

alter table public.match_dispute_tickets
  drop constraint if exists match_dispute_tickets_attachment_paths_card;

alter table public.match_dispute_tickets
  add constraint match_dispute_tickets_attachment_paths_card check (
    cardinality(coalesce(attachment_paths, '{}')) <= 5
  );

-- Bucket public : lecture URL directe ; écriture réservée aux joueurs du match (policies).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dispute-evidence',
  'dispute-evidence',
  true,
  2621440,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dispute-evidence insert match players" on storage.objects;
create policy "dispute-evidence insert match players"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dispute-evidence'
    and split_part(name, '/', 1) = 'dispute'
    and exists (
      select 1
      from public.matches m
      where m.id::text = split_part(name, '/', 2)
        and (m.player_a = (select auth.uid()) or m.player_b = (select auth.uid()))
        and (select auth.uid())::text = split_part(name, '/', 3)
    )
  );

drop policy if exists "dispute-evidence read all" on storage.objects;
create policy "dispute-evidence read all"
  on storage.objects for select
  using (bucket_id = 'dispute-evidence');

create or replace function public.match_dispute_paths_valid(
  p_paths text[],
  p_match_id uuid,
  p_uid uuid
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  p text;
  parts text[];
  n int;
begin
  n := cardinality(coalesce(p_paths, '{}'));
  if n > 5 then
    return false;
  end if;
  if n = 0 then
    return true;
  end if;
  foreach p in array coalesce(p_paths, '{}')
  loop
    parts := string_to_array(p, '/');
    if array_length(parts, 1) is distinct from 4 then
      return false;
    end if;
    if parts[1] is distinct from 'dispute' then
      return false;
    end if;
    if parts[2] is distinct from p_match_id::text then
      return false;
    end if;
    if parts[3] is distinct from p_uid::text then
      return false;
    end if;
    if parts[4] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp)$' then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

drop function if exists public.match_submit_dispute_ticket(uuid, text);

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
  uid uuid := auth.uid();
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
      and m.status <> 'confirmed'
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

  header :=
    '[Résumé automatique — scores déclarés, perspective globale A vs B]' || E'\n' ||
    'Ton score déclaré (A — B) : ' ||
    coalesce(my_a::text, '—') || ' — ' || coalesce(my_b::text, '—') || E'\n' ||
    'Score déclaré par l''adversaire (A — B) : ' ||
    coalesce(opp_a::text, '—') || ' — ' || coalesce(opp_b::text, '—') || E'\n' ||
    E'\n---' || E'\n' ||
    'Pourquoi tu estimes avoir raison (et pas l''autre joueur) :' || E'\n';

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
    and status <> 'confirmed';

  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('error', 'not_found_or_forbidden');
  end if;

  insert into public.match_dispute_tickets (match_id, opened_by, body, attachment_paths)
  values (p_match_id, uid, t, paths);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.match_submit_dispute_ticket(uuid, text, text[]) to authenticated;
