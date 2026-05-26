-- À exécuter dans Supabase → SQL Editor (une fois).
-- Ranked : défis ouverts + file d’attente + matchs

create table if not exists public.open_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  creator_display_name text,
  opponent_id uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'matched', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references auth.users (id) on delete cascade,
  player_b uuid not null references auth.users (id) on delete cascade,
  player_a_label text,
  player_b_label text,
  source text not null check (source in ('challenge', 'queue')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'disputed', 'cancelled')),
  challenge_id uuid references public.open_challenges (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint player_order check (player_a <> player_b)
);

create table if not exists public.match_queue (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_open_challenges_status on public.open_challenges (status);
create index if not exists idx_matches_players on public.matches (player_a, player_b);

alter table public.open_challenges enable row level security;
alter table public.matches enable row level security;
alter table public.match_queue enable row level security;

-- Lecture des défis ouverts
create policy "open_challenges_select"
  on public.open_challenges for select
  to authenticated
  using (true);

-- Créer un défi
create policy "open_challenges_insert"
  on public.open_challenges for insert
  to authenticated
  with check (creator_id = (select auth.uid()));

-- Annuler son propre défi
create policy "open_challenges_update_creator"
  on public.open_challenges for update
  to authenticated
  using (creator_id = (select auth.uid()) and status = 'open');

-- Matchs visibles si joueur
create policy "matches_select_own"
  on public.matches for select
  to authenticated
  using (
    player_a = (select auth.uid())
    or player_b = (select auth.uid())
  );

-- Pas d’INSERT direct sur matches : uniquement via fonctions security definer

-- File : voir sa ligne uniquement (optionnel ; le pairing passe par RPC)
create policy "match_queue_own"
  on public.match_queue for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "match_queue_insert_own"
  on public.match_queue for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "match_queue_delete_own"
  on public.match_queue for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Fonction : rejoindre la file et tenter un appariement
-- Paramètre jsonb (ignoré). Nom `queue_ctx` (éviter `payload`, ambigu pour PostgREST).
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

grant execute on function public.join_ranked_queue(jsonb) to authenticated;

-- Accepter un défi ouvert
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

grant execute on function public.accept_open_challenge(uuid) to authenticated;

-- Rafraîchit le cache PostgREST (évite « Could not find the function … in the schema cache »)
notify pgrst, 'reload schema';
