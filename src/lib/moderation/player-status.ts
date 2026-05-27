import { dbQuery, dbQueryOne } from "@/lib/db/query";

export type PlayerModerationStatus = {
  user_id: string;
  email: string;
  display_name: string | null;
  roblox_username: string | null;
  banned_at: string | null;
  ban_reason: string | null;
  blame_active: boolean;
  blame_fair_wins_required: number;
  blame_fair_wins_done: number;
  blame_count: number;
  blame_note: string | null;
  blame_applied_at: string | null;
};

export async function getPlayerModerationStatus(
  userId: string,
): Promise<PlayerModerationStatus | null> {
  return dbQueryOne<PlayerModerationStatus>(
    `
    select
      u.id as user_id,
      u.email,
      u.display_name,
      u.roblox_username,
      u.banned_at,
      u.ban_reason,
      coalesce(s.blame_active, false) as blame_active,
      coalesce(s.blame_fair_wins_required, 0) as blame_fair_wins_required,
      coalesce(s.blame_fair_wins_done, 0) as blame_fair_wins_done,
      coalesce(s.blame_count, 0) as blame_count,
      s.blame_note,
      s.blame_applied_at
    from public.users u
    left join public.player_ranked_stats s on s.user_id = u.id
    where u.id = $1
    `,
    [userId],
  );
}

export async function isUserBanned(userId: string): Promise<boolean> {
  const row = await dbQueryOne<{ banned_at: string | null }>(
    `select banned_at from public.users where id = $1`,
    [userId],
  );
  return row?.banned_at != null;
}

export type ModerationEventRow = {
  id: string;
  kind: string;
  note: string | null;
  created_at: string;
  admin_email: string | null;
};

export async function listPlayerModerationEvents(
  userId: string,
  limit = 12,
): Promise<ModerationEventRow[]> {
  const lim = Math.min(Math.max(limit, 1), 50);
  return dbQuery<ModerationEventRow>(
    `
    select
      e.id,
      e.kind,
      e.note,
      e.created_at,
      a.email as admin_email
    from public.player_moderation_events e
    left join public.users a on a.id = e.admin_id
    where e.user_id = $1
    order by e.created_at desc
    limit $2
    `,
    [userId, lim],
  );
}
