import { dbQuery } from "@/lib/db/query";

/** Utilisateurs ayant au moins un match pending/disputed (une seule requête). */
export async function userIdsWithOpenMatches(
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const rows = await dbQuery<{ user_id: string }>(
    `
    select distinct u.id::text as user_id
    from unnest($1::uuid[]) as u(id)
    where exists (
      select 1
      from public.matches m
      where m.status in ('pending', 'disputed')
        and (m.player_a = u.id or m.player_b = u.id)
    )
    `,
    [userIds],
  );

  return new Set(rows.map((r) => r.user_id));
}
