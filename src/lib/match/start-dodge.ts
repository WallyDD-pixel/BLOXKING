import { dbQueryOne } from "@/lib/db/query";

export async function getStartDodgeCountVsOpponent(
  userId: string,
  opponentId: string,
): Promise<number> {
  const row = await dbQueryOne<{ dodge_count: string }>(
    `
    select public.get_start_dodge_count($1::uuid, $2::uuid)::text as dodge_count
    `,
    [userId, opponentId],
  );
  return Number(row?.dodge_count ?? 0);
}
