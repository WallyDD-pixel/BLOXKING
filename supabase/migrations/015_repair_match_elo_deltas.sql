-- Recalcule elo_delta_a / elo_delta_b pour les matchs confirmés déjà traités sans deltas
-- (ex. traités avant la migration 014). À exécuter une fois depuis le SQL Editor (rôle service) :
--   select public.repair_match_elo_delta_columns();

create or replace function public.repair_match_elo_delta_columns()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
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
  ma int;
  mb int;
  updated int := 0;
begin
  create temp table _elo_sim (
    user_id uuid primary key,
    elo int not null default 1000,
    pl int not null default 0
  ) on commit drop;

  for m in
    select *
    from public.matches
    where status = 'confirmed'
      and coalesce(elo_processed, false) = true
    order by created_at asc
  loop
    ma := m.claim_from_a_maps_a;
    mb := m.claim_from_a_maps_b;
    if ma is null or mb is null then
      continue;
    end if;

    insert into _elo_sim (user_id) values (m.player_a) on conflict (user_id) do nothing;
    insert into _elo_sim (user_id) values (m.player_b) on conflict (user_id) do nothing;

    select elo, pl into ra, pa_pl from _elo_sim where user_id = m.player_a;
    select elo, pl into rb, pb_pl from _elo_sim where user_id = m.player_b;

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

    update public.matches
    set
      elo_delta_a = ra - ra0,
      elo_delta_b = rb - rb0
    where id = m.id;

    updated := updated + 1;

    update _elo_sim
    set
      elo = ra,
      pl = least(5, pl + 1)
    where user_id = m.player_a;

    update _elo_sim
    set
      elo = rb,
      pl = least(5, pl + 1)
    where user_id = m.player_b;
  end loop;

  return jsonb_build_object('ok', true, 'matches_replayed', updated);
end;
$$;

revoke all on function public.repair_match_elo_delta_columns() from public;
grant execute on function public.repair_match_elo_delta_columns() to service_role;

notify pgrst, 'reload schema';
