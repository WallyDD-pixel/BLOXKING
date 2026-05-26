-- ELO (départ 1000), placement 5 parties (K=40 puis K=20), une seule fois par match confirmé.

alter table public.matches
  add column if not exists elo_processed boolean not null default false;

create table if not exists public.player_ranked_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  elo int not null default 1000
    check (elo >= 100 and elo <= 4000),
  placement_matches_played int not null default 0
    check (placement_matches_played >= 0 and placement_matches_played <= 5),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_ranked_stats_elo
  on public.player_ranked_stats (elo desc);

alter table public.player_ranked_stats enable row level security;

drop policy if exists "player_ranked_stats_select_own" on public.player_ranked_stats;
drop policy if exists "player_ranked_stats_select_leaderboard" on public.player_ranked_stats;
drop policy if exists "player_ranked_stats_select_public_anon" on public.player_ranked_stats;

-- Classement : lecture publique (authentifié + anon).
create policy "player_ranked_stats_select_leaderboard"
  on public.player_ranked_stats for select
  to authenticated
  using (true);

create policy "player_ranked_stats_select_public_anon"
  on public.player_ranked_stats for select
  to anon
  using (true);

-- Pas d'INSERT/UPDATE client : uniquement via fonctions security definer.

create or replace function public.apply_elo_after_match_confirm(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  pa uuid;
  pb uuid;
  ma int;
  mb int;
  ra int;
  rb int;
  pa_pl int;
  pb_pl int;
  ka int;
  kb int;
  ea numeric;
  eb numeric;
  sa numeric;
  sb numeric;
  a_wins boolean;
  dra int;
  drb int;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.status <> 'confirmed' then
    return;
  end if;
  if m.elo_processed then
    return;
  end if;

  pa := m.player_a;
  pb := m.player_b;
  ma := m.claim_from_a_maps_a;
  mb := m.claim_from_a_maps_b;

  if ma is null or mb is null then
    return;
  end if;

  insert into public.player_ranked_stats (user_id, elo, placement_matches_played)
  values (pa, 1000, 0)
  on conflict (user_id) do nothing;
  insert into public.player_ranked_stats (user_id, elo, placement_matches_played)
  values (pb, 1000, 0)
  on conflict (user_id) do nothing;

  select elo, placement_matches_played into ra, pa_pl
  from public.player_ranked_stats where user_id = pa;
  select elo, placement_matches_played into rb, pb_pl
  from public.player_ranked_stats where user_id = pb;

  a_wins := ma > mb;
  sa := case when a_wins then 1.0 else 0.0 end;
  sb := 1.0 - sa;

  ea := 1.0 / (1.0 + power(10::numeric, (rb - ra) / 400.0));
  eb := 1.0 / (1.0 + power(10::numeric, (ra - rb) / 400.0));

  ka := case when pa_pl < 5 then 40 else 20 end;
  kb := case when pb_pl < 5 then 40 else 20 end;

  dra := round(ka * (sa - ea))::int;
  drb := round(kb * (sb - eb))::int;

  ra := greatest(100, least(4000, ra + dra));
  rb := greatest(100, least(4000, rb + drb));

  update public.player_ranked_stats
  set
    elo = ra,
    placement_matches_played = least(5, pa_pl + 1),
    updated_at = now()
  where user_id = pa;

  update public.player_ranked_stats
  set
    elo = rb,
    placement_matches_played = least(5, pb_pl + 1),
    updated_at = now()
  where user_id = pb;

  update public.matches
  set elo_processed = true
  where id = p_match_id;
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

  if r.status = 'confirmed' then
    return jsonb_build_object('error', 'match_already_finished');
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

  perform public.apply_elo_after_match_confirm(p_match_id);

  return jsonb_build_object('ok', true);
end;
$$;

notify pgrst, 'reload schema';
