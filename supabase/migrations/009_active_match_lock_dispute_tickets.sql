-- Un seul match actif (pending / disputed) par joueur pour file + défis.
-- Tickets de litige (message obligatoire) liés au match.

create or replace function public.user_has_open_ranked_match(p_uid uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where (m.player_a = p_uid or m.player_b = p_uid)
      and m.status in ('pending', 'disputed')
  );
$$;

create table if not exists public.match_dispute_tickets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  opened_by uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint match_dispute_tickets_body_len check (
    char_length(trim(body)) >= 10
    and char_length(body) <= 2000
  )
);

create index if not exists idx_match_dispute_tickets_match_id
  on public.match_dispute_tickets (match_id desc);

alter table public.match_dispute_tickets enable row level security;

drop policy if exists "match_dispute_tickets_select_players" on public.match_dispute_tickets;

create policy "match_dispute_tickets_select_players"
  on public.match_dispute_tickets for select
  to authenticated
  using (
    exists (
      select 1
      from public.matches m
      where m.id = match_id
        and (m.player_a = (select auth.uid()) or m.player_b = (select auth.uid()))
    )
  );

-- Pas d'insert direct client : RPC security definer uniquement.

create or replace function public.match_submit_dispute_ticket(
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
  n int;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if char_length(t) < 10 then
    return jsonb_build_object('error', 'ticket_body_too_short');
  end if;
  if char_length(t) > 2000 then
    return jsonb_build_object('error', 'ticket_body_too_long');
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

  if exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and m.dispute = true
  ) then
    insert into public.match_dispute_tickets (match_id, opened_by, body)
    values (p_match_id, uid, t);
    return jsonb_build_object('ok', true, 'follow_up', true);
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

  insert into public.match_dispute_tickets (match_id, opened_by, body)
  values (p_match_id, uid, t);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.match_submit_dispute_ticket(uuid, text) to authenticated;

create or replace function public.join_ranked_queue(queue_ctx jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  partner uuid;
  new_id uuid;
  pa uuid;
  pb uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if public.user_has_open_ranked_match(uid) then
    return jsonb_build_object('error', 'active_match_in_progress');
  end if;

  insert into match_queue (user_id, created_at)
  values (uid, now())
  on conflict (user_id) do update set created_at = excluded.created_at;

  select mq.user_id into partner
  from match_queue mq
  where mq.user_id <> uid
  order by mq.created_at asc
  limit 1;

  if partner is null then
    return jsonb_build_object('matched', false);
  end if;

  if public.user_has_open_ranked_match(partner) then
    delete from match_queue where user_id = partner;
    return jsonb_build_object('matched', false);
  end if;

  delete from match_queue where user_id in (uid, partner);

  if uid::text < partner::text then
    pa := uid; pb := partner;
  else
    pa := partner; pb := uid;
  end if;

  insert into matches (player_a, player_b, source, status)
  values (pa, pb, 'queue', 'pending')
  returning id into new_id;

  return jsonb_build_object(
    'matched', true,
    'match_id', new_id,
    'opponent_id', partner
  );
end;
$$;

create or replace function public.accept_open_challenge(challenge_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c record;
  new_match uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if public.user_has_open_ranked_match(uid) then
    return jsonb_build_object('error', 'active_match_in_progress');
  end if;

  select * into c
  from open_challenges
  where id = challenge_uuid
  for update;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if c.status <> 'open' then
    return jsonb_build_object('error', 'not_open');
  end if;
  if c.creator_id = uid then
    return jsonb_build_object('error', 'cannot_accept_own');
  end if;

  if public.user_has_open_ranked_match(c.creator_id) then
    return jsonb_build_object('error', 'challenger_has_active_match');
  end if;

  update open_challenges
  set opponent_id = uid, status = 'matched'
  where id = challenge_uuid;

  insert into matches (player_a, player_b, source, status, challenge_id)
  values (
    least(c.creator_id, uid),
    greatest(c.creator_id, uid),
    'challenge',
    'pending',
    challenge_uuid
  )
  returning id into new_match;

  return jsonb_build_object('ok', true, 'match_id', new_match);
end;
$$;

notify pgrst, 'reload schema';
