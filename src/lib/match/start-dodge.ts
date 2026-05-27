import { dbQueryOne } from "@/lib/db/query";

export async function getStartDodgeCountVsOpponent(
  userId: string,
  opponentId: string,
): Promise<number> {
  const row = await dbQueryOne<{ dodge_count: string }>(
    `
    select coalesce(d.dodge_count, 0)::text as dodge_count
    from public.player_opponent_start_dodges d
    where d.user_id = $1
      and d.opponent_id = $2
    `,
    [userId, opponentId],
  );
  return Number(row?.dodge_count ?? 0);
}
