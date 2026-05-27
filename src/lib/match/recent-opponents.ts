import { dbQuery } from "@/lib/db/query";

/** Historique pris en compte pour éviter les rematches. */
export const REMATCH_LOOKBACK_HOURS = 24;

export type RecentOpponentInfo = {
  count: number;
  lastAtMs: number;
};

/** Adversaires récents (file matchmaking) pour le joueur courant. */
export async function loadRecentQueueOpponents(
  userId: string,
): Promise<Map<string, RecentOpponentInfo>> {
  const rows = await dbQuery<{
    opponent_id: string;
    match_count: string;
    last_played_at: string;
  }>(
    `
    select
      case when m.player_a = $1 then m.player_b else m.player_a end as opponent_id,
      count(*)::text as match_count,
      max(m.created_at) as last_played_at
    from public.matches m
    where m.source = 'queue'
      and (m.player_a = $1 or m.player_b = $1)
      and m.created_at > now() - make_interval(hours => $2::int)
    group by 1
    `,
    [userId, REMATCH_LOOKBACK_HOURS],
  );

  const map = new Map<string, RecentOpponentInfo>();
  for (const row of rows) {
    const lastAtMs = new Date(String(row.last_played_at)).getTime();
    map.set(String(row.opponent_id), {
      count: Number(row.match_count) || 0,
      lastAtMs: Number.isFinite(lastAtMs) ? lastAtMs : 0,
    });
  }
  return map;
}
