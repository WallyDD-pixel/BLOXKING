import { dbQuery } from "@/lib/db/query";

/** Match confirmé avec score consensuel (même logique que le profil joueur). */
export const CONFIRMED_CONSENSUS_SQL = `
  status = 'confirmed'
  and claim_from_a_maps_a is not null
  and claim_from_b_maps_a is not null
  and claim_from_a_maps_a = claim_from_b_maps_a
  and claim_from_a_maps_b = claim_from_b_maps_b
`;

export type LeaderboardRow = {
  user_id: string;
  elo: number;
  placement_matches_played: number;
  roblox_username: string | null;
  display_name: string | null;
  email: string;
  wins: number;
  losses: number;
  maps_won: number;
  maps_lost: number;
};

export function computeWinRatePercent(wins: number, losses: number): number | null {
  const decided = wins + losses;
  if (decided <= 0) return null;
  return Math.round((wins / decided) * 100);
}

/** Ratio maps gagnées / perdues (équivalent K/D sur les manches BO3). */
export function computeMapKda(mapsWon: number, mapsLost: number): number | null {
  if (mapsWon <= 0 && mapsLost <= 0) return null;
  if (mapsLost <= 0) return mapsWon;
  return Math.round((mapsWon / mapsLost) * 100) / 100;
}

export function formatMapKda(mapsWon: number, mapsLost: number): string {
  const kda = computeMapKda(mapsWon, mapsLost);
  if (kda == null) return "—";
  return kda.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

export function formatWinRate(wins: number, losses: number): string {
  const pct = computeWinRatePercent(wins, losses);
  if (pct == null) return "—";
  return `${pct}%`;
}

export async function getLeaderboardRows(limit = 50): Promise<LeaderboardRow[]> {
  const lim = Math.min(Math.max(limit, 1), 100);
  return dbQuery<LeaderboardRow>(
    `
    select
      s.user_id,
      s.elo,
      s.placement_matches_played,
      u.roblox_username,
      u.display_name,
      u.email,
      coalesce(st.wins, 0)::int as wins,
      coalesce(st.losses, 0)::int as losses,
      coalesce(st.maps_won, 0)::int as maps_won,
      coalesce(st.maps_lost, 0)::int as maps_lost
    from public.player_ranked_stats s
    join public.users u on u.id = s.user_id
    left join lateral (
      select
        count(*) filter (where
          (m.player_a = s.user_id and m.claim_from_a_maps_a > m.claim_from_a_maps_b)
          or (m.player_b = s.user_id and m.claim_from_a_maps_b > m.claim_from_a_maps_a)
        )::int as wins,
        count(*) filter (where
          (m.player_a = s.user_id and m.claim_from_a_maps_a < m.claim_from_a_maps_b)
          or (m.player_b = s.user_id and m.claim_from_a_maps_b < m.claim_from_a_maps_a)
        )::int as losses,
        coalesce(sum(
          case
            when m.player_a = s.user_id then m.claim_from_a_maps_a
            else m.claim_from_a_maps_b
          end
        ), 0)::int as maps_won,
        coalesce(sum(
          case
            when m.player_a = s.user_id then m.claim_from_a_maps_b
            else m.claim_from_a_maps_a
          end
        ), 0)::int as maps_lost
      from public.matches m
      where (m.player_a = s.user_id or m.player_b = s.user_id)
        and m.status = 'confirmed'
        and m.claim_from_a_maps_a is not null
        and m.claim_from_b_maps_a is not null
        and m.claim_from_a_maps_a = m.claim_from_b_maps_a
        and m.claim_from_a_maps_b = m.claim_from_b_maps_b
    ) st on true
    order by s.elo desc
    limit $1
    `,
    [lim],
  );
}
