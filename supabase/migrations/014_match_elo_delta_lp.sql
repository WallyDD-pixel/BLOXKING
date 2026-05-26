-- Variation de LP (ELO) par joueur pour l’historique des rencontres.

alter table public.matches
  add column if not exists elo_delta_a smallint,
  add column if not exists elo_delta_b smallint;

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
  ra0 int;
  rb0 int;
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

  ra0 := ra;
  rb0 := rb;

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
  set
    elo_processed = true,
    elo_delta_a = ra - ra0,
    elo_delta_b = rb - rb0
  where id = p_match_id;
end;
$$;

notify pgrst, 'reload schema';
