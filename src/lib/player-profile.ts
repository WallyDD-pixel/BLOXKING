import { dbQuery, dbQueryOne } from "@/lib/db/query";
import { playerDisplayName } from "@/lib/player-display-name";
import { DEFAULT_ELO, PLACEMENT_TOTAL } from "@/lib/ranked";

export type PlayerMatchSummary = {
  id: string;
  created_at: string;
  source: string;
  opponent_label: string;
  maps_won: number;
  maps_lost: number;
  outcome: "win" | "loss" | "draw";
  elo_delta: number | null;
};

export type PlayerPublicProfile = {
  id: string;
  display_name: string;
  roblox_username: string | null;
  email_local: string;
  member_since: string;
  elo: number;
  placement_matches_played: number;
  rank: number | null;
  stats: {
    confirmed: number;
    wins: number;
    losses: number;
    draws: number;
    win_rate: number | null;
    maps_won: number;
    maps_lost: number;
    pending: number;
    disputed: number;
    cancelled: number;
  };
  recent_matches: PlayerMatchSummary[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUserId(id: string): boolean {
  return UUID_RE.test(id);
}

export async function getPlayerPublicProfile(
  userId: string,
): Promise<PlayerPublicProfile | null> {
  if (!isValidUserId(userId)) return null;

  const user = await dbQueryOne<{
    id: string;
    roblox_username: string | null;
    display_name: string | null;
    email: string;
    created_at: string;
  }>(
    `
    select id, roblox_username, display_name, email, created_at
    from public.users
    where id = $1
    `,
    [userId],
  );
  if (!user) return null;

  const ranked = await dbQueryOne<{
    elo: number;
    placement_matches_played: number;
  }>(
    `
    select elo, placement_matches_played
    from public.player_ranked_stats
    where user_id = $1
    `,
    [userId],
  );

  const elo = ranked?.elo ?? DEFAULT_ELO;
  const placement = ranked?.placement_matches_played ?? 0;

  const rankRow = ranked
    ? await dbQueryOne<{ rank: number }>(
        `
        select (count(*) + 1)::int as rank
        from public.player_ranked_stats
        where elo > $1
        `,
        [elo],
      )
    : null;

  const agg = await dbQueryOne<{
    confirmed: string;
    wins: string;
    losses: string;
    draws: string;
    maps_won: string;
    maps_lost: string;
    pending: string;
    disputed: string;
    cancelled: string;
  }>(
    `
    select
      count(*) filter (where status = 'confirmed'
        and claim_from_a_maps_a is not null
        and claim_from_b_maps_a is not null
        and claim_from_a_maps_a = claim_from_b_maps_a
        and claim_from_a_maps_b = claim_from_b_maps_b
      )::text as confirmed,
      count(*) filter (where status = 'confirmed'
        and claim_from_a_maps_a is not null
        and claim_from_b_maps_a is not null
        and claim_from_a_maps_a = claim_from_b_maps_a
        and claim_from_a_maps_b = claim_from_b_maps_b
        and (
          (player_a = $1 and claim_from_a_maps_a > claim_from_a_maps_b)
          or (player_b = $1 and claim_from_a_maps_b > claim_from_a_maps_a)
        )
      )::text as wins,
      count(*) filter (where status = 'confirmed'
        and claim_from_a_maps_a is not null
        and claim_from_b_maps_a is not null
        and claim_from_a_maps_a = claim_from_b_maps_a
        and claim_from_a_maps_b = claim_from_b_maps_b
        and (
          (player_a = $1 and claim_from_a_maps_a < claim_from_a_maps_b)
          or (player_b = $1 and claim_from_a_maps_b < claim_from_a_maps_a)
        )
      )::text as losses,
      count(*) filter (where status = 'confirmed'
        and claim_from_a_maps_a is not null
        and claim_from_b_maps_a is not null
        and claim_from_a_maps_a = claim_from_b_maps_a
        and claim_from_a_maps_b = claim_from_b_maps_b
        and claim_from_a_maps_a = claim_from_a_maps_b
      )::text as draws,
      coalesce(sum(
        case
          when status = 'confirmed'
            and claim_from_a_maps_a is not null
            and claim_from_b_maps_a is not null
            and claim_from_a_maps_a = claim_from_b_maps_a
            and claim_from_a_maps_b = claim_from_b_maps_b
          then case when player_a = $1 then claim_from_a_maps_a else claim_from_a_maps_b end
          else 0
        end
      ), 0)::text as maps_won,
      coalesce(sum(
        case
          when status = 'confirmed'
            and claim_from_a_maps_a is not null
            and claim_from_b_maps_a is not null
            and claim_from_a_maps_a = claim_from_b_maps_a
            and claim_from_a_maps_b = claim_from_b_maps_b
          then case when player_a = $1 then claim_from_a_maps_b else claim_from_a_maps_a end
          else 0
        end
      ), 0)::text as maps_lost,
      count(*) filter (where status = 'pending')::text as pending,
      count(*) filter (where status = 'disputed')::text as disputed,
      count(*) filter (where status = 'cancelled')::text as cancelled
    from public.matches
    where player_a = $1 or player_b = $1
    `,
    [userId],
  );

  const confirmed = Number(agg?.confirmed ?? 0);
  const wins = Number(agg?.wins ?? 0);
  const losses = Number(agg?.losses ?? 0);
  const draws = Number(agg?.draws ?? 0);
  const decided = wins + losses;
  const win_rate = decided > 0 ? Math.round((wins / decided) * 100) : null;

  const recentRows = await dbQuery<{
    id: string;
    created_at: string;
    source: string;
    player_a: string;
    player_b: string;
    player_a_label: string | null;
    player_b_label: string | null;
    claim_from_a_maps_a: number | null;
    claim_from_a_maps_b: number | null;
    claim_from_b_maps_a: number | null;
    claim_from_b_maps_b: number | null;
    elo_delta_a: number | null;
    elo_delta_b: number | null;
    status: string;
  }>(
    `
    select
      id, created_at, source, player_a, player_b,
      player_a_label, player_b_label,
      claim_from_a_maps_a, claim_from_a_maps_b,
      claim_from_b_maps_a, claim_from_b_maps_b,
      elo_delta_a, elo_delta_b, status
    from public.matches
    where (player_a = $1 or player_b = $1)
      and status = 'confirmed'
      and claim_from_a_maps_a is not null
      and claim_from_b_maps_a is not null
      and claim_from_a_maps_a = claim_from_b_maps_a
      and claim_from_a_maps_b = claim_from_b_maps_b
    order by created_at desc
    limit 12
    `,
    [userId],
  );

  const recent_matches: PlayerMatchSummary[] = recentRows.map((m) => {
    const isA = m.player_a === userId;
    const mw = isA ? m.claim_from_a_maps_a! : m.claim_from_a_maps_b!;
    const ml = isA ? m.claim_from_a_maps_b! : m.claim_from_a_maps_a!;
    let outcome: "win" | "loss" | "draw" = "draw";
    if (mw > ml) outcome = "win";
    else if (ml > mw) outcome = "loss";
    const elo_delta = isA ? m.elo_delta_a : m.elo_delta_b;
    const opponent_label = isA
      ? (m.player_b_label?.trim() || "Adversaire")
      : (m.player_a_label?.trim() || "Adversaire");

    return {
      id: m.id,
      created_at: m.created_at,
      source: m.source,
      opponent_label,
      maps_won: mw,
      maps_lost: ml,
      outcome,
      elo_delta: elo_delta != null ? Number(elo_delta) : null,
    };
  });

  return {
    id: user.id,
    display_name: playerDisplayName(user),
    roblox_username: user.roblox_username?.trim() || null,
    email_local: user.email.split("@")[0] ?? "",
    member_since: user.created_at,
    elo,
    placement_matches_played: placement,
    rank: rankRow?.rank ?? null,
    stats: {
      confirmed,
      wins,
      losses,
      draws,
      win_rate,
      maps_won: Number(agg?.maps_won ?? 0),
      maps_lost: Number(agg?.maps_lost ?? 0),
      pending: Number(agg?.pending ?? 0),
      disputed: Number(agg?.disputed ?? 0),
      cancelled: Number(agg?.cancelled ?? 0),
    },
    recent_matches,
  };
}

export function placementLabel(played: number): string {
  const n = Math.min(played, PLACEMENT_TOTAL);
  if (n >= PLACEMENT_TOTAL) return "Classé";
  return `Placement ${n}/${PLACEMENT_TOTAL}`;
}
