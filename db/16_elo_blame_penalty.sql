-- ELO : pénalité de défaite amplifiée si blame actif + 2 victoires « loyales » pour lever le blame.

create or replace function public.process_blame_fair_wins_after_match(
  p_match_id uuid,
  p_winner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.player_ranked_stats%rowtype;
  v_source text;
  v_had_dispute boolean;
begin
  if p_winner_id is null then
    return;
  end if;

  select m.source into v_source
  from public.matches m
  where m.id = p_match_id;

  if v_source is distinct from 'queue' then
    return;
  end if;

  select exists (
    select 1 from public.match_dispute_tickets t
    where t.match_id = p_match_id
  ) into v_had_dispute;

  if v_had_dispute then
    return;
  end if;

  select * into s
  from public.player_ranked_stats
  where user_id = p_winner_id
  for update;

  if not found or not s.blame_active then
    return;
  end if;

  update public.player_ranked_stats
  set
    blame_fair_wins_done = least(
      s.blame_fair_wins_required,
      s.blame_fair_wins_done + 1
    ),
    updated_at = now()
  where user_id = p_winner_id
  returning * into s;

  if s.blame_fair_wins_done >= s.blame_fair_wins_required
     and s.blame_fair_wins_required > 0 then
    update public.player_ranked_stats
    set
      blame_active = false,
      blame_fair_wins_required = 0,
      blame_fair_wins_done = 0,
      blame_note = null,
      blame_match_id = null,
      blame_applied_at = null,
      updated_at = now()
    where user_id = p_winner_id;

    insert into public.player_moderation_events (user_id, match_id, kind, note)
    values (
      p_winner_id,
      p_match_id,
      'blame_cleared',
      '2 victoires à la loyale'
    );
  else
    insert into public.player_moderation_events (user_id, match_id, kind, note)
    values (
      p_winner_id,
      p_match_id,
      'blame_progress',
      format('%s/%s victoires loyales', s.blame_fair_wins_done, s.blame_fair_wins_required)
    );
  end if;
end;
$$;

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
  rank_a int;
  rank_b int;
  bonus_a numeric := 1.0;
  bonus_b numeric := 1.0;
  dra int;
  drb int;
  pa_blame boolean;
  pb_blame boolean;
  v_winner uuid;
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

  select elo, placement_matches_played,
         coalesce(blame_active, false)
  into ra, pa_pl, pa_blame
  from public.player_ranked_stats where user_id = pa;

  select elo, placement_matches_played,
         coalesce(blame_active, false)
  into rb, pb_pl, pb_blame
  from public.player_ranked_stats where user_id = pb;

  ra0 := ra;
  rb0 := rb;

  select (count(*) + 1)::int into rank_a
  from public.player_ranked_stats
  where elo > ra0;
  select (count(*) + 1)::int into rank_b
  from public.player_ranked_stats
  where elo > rb0;

  a_wins := ma > mb;
  if a_wins then
    bonus_a := public.elo_upset_bonus(ra0, rb0, rank_b);
    v_winner := pa;
  else
    bonus_b := public.elo_upset_bonus(rb0, ra0, rank_a);
    v_winner := pb;
  end if;

  sa := case when a_wins then 1.0 else 0.0 end;
  sb := 1.0 - sa;

  ea := 1.0 / (1.0 + power(10::numeric, (rb - ra) / 400.0));
  eb := 1.0 / (1.0 + power(10::numeric, (ra - rb) / 400.0));

  ka := case when pa_pl < 5 then 40 else 20 end;
  kb := case when pb_pl < 5 then 40 else 20 end;

  dra := round(ka * (sa - ea) * bonus_a)::int;
  drb := round(kb * (sb - eb) * bonus_b)::int;

  if pa_blame and dra < 0 then
    dra := round(dra * 2.5)::int;
  end if;
  if pb_blame and drb < 0 then
    drb := round(drb * 2.5)::int;
  end if;

  ra := greatest(100, least(4000, ra + dra));
  rb := greatest(100, least(4000, rb + drb));

  update public.player_ranked_stats
  set
    elo = ra,
    placement_matches_played = least(5, pa_pl + 1),
    updated_at = now(),
    queue_available_after = now() + interval '12 seconds'
  where user_id = pa;

  update public.player_ranked_stats
  set
    elo = rb,
    placement_matches_played = least(5, pb_pl + 1),
    updated_at = now(),
    queue_available_after = now() + interval '12 seconds'
  where user_id = pb;

  update public.matches
  set
    elo_processed = true,
    elo_delta_a = ra - ra0,
    elo_delta_b = rb - rb0
  where id = p_match_id;

  perform public.process_blame_fair_wins_after_match(p_match_id, v_winner);
end;
$$;

grant execute on function public.process_blame_fair_wins_after_match(uuid, uuid) to public;
