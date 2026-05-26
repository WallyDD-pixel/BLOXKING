-- Chat entre joueurs pendant le litige (hors fil modération).
-- push_notification_sent_at : réservé à un futur worker (push / e-mail) une fois la notif envoyée.

create table if not exists public.match_dispute_chat_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  push_notification_sent_at timestamptz,
  constraint match_dispute_chat_body_len check (
    char_length(trim(body)) >= 1
    and char_length(body) <= 2000
  )
);

create index if not exists idx_match_dispute_chat_match_created
  on public.match_dispute_chat_messages (match_id, created_at asc);

alter table public.match_dispute_chat_messages enable row level security;

drop policy if exists "match_dispute_chat_select_players" on public.match_dispute_chat_messages;

create policy "match_dispute_chat_select_players"
  on public.match_dispute_chat_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.matches m
      where m.id = match_id
        and (m.player_a = (select auth.uid()) or m.player_b = (select auth.uid()))
    )
  );

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
      and m.status = 'disputed'
      and m.dispute = true
  ) then
    return jsonb_build_object('error', 'dispute_chat_forbidden');
  end if;

  insert into public.match_dispute_chat_messages (match_id, author_id, body)
  values (p_match_id, uid, t)
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

grant execute on function public.match_post_dispute_chat_message(uuid, text) to authenticated;

-- Après reset litige : vider le chat négociation.
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

  delete from public.match_dispute_chat_messages
  where match_id = p_match_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Annulation auto 30 min : supprimer aussi l’historique chat.
create or replace function public.expire_disputed_matches_after_ticket_timeout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  delete from public.match_dispute_chat_messages c
  using public.matches m
  inner join (
    select match_id, min(created_at) as first_at
    from public.match_dispute_tickets
    group by match_id
  ) ft on ft.match_id = m.id
  where c.match_id = m.id
    and m.status = 'disputed'
    and m.dispute = true
    and ft.first_at < now() - interval '30 minutes';

  with first_ticket as (
    select match_id, min(created_at) as first_at
    from public.match_dispute_tickets
    group by match_id
  ),
  due as (
    select m.id
    from public.matches m
    inner join first_ticket ft on ft.match_id = m.id
    where m.status = 'disputed'
      and m.dispute = true
      and ft.first_at < now() - interval '30 minutes'
  )
  update public.matches m
  set
    status = 'cancelled',
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
  from due
  where m.id = due.id;

  get diagnostics n = row_count;
  return jsonb_build_object('cancelled', n);
end;
$$;

-- Temps réel (optionnel) : Dashboard → Database → Replication pour match_dispute_chat_messages
-- ou : alter publication supabase_realtime add table public.match_dispute_chat_messages;

notify pgrst, 'reload schema';
