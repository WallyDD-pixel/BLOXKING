import { dbQueryOne } from "@/lib/db/query";

const CTRL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Chemin de page pour l’admin (pathname uniquement). */
export function sanitizePresencePath(path: string | null | undefined): string {
  if (!path?.trim()) return "/";
  let s = path.trim().replace(CTRL, "");
  if (!s.startsWith("/")) s = `/${s}`;
  if (s.length > 200) s = s.slice(0, 200);
  return s;
}

export async function recordUserPresence(
  userId: string,
  path?: string | null,
): Promise<void> {
  const safePath = sanitizePresencePath(path);
  await dbQueryOne(
    `
    update public.users
    set
      last_seen_at = now(),
      last_seen_path = $2
    where id = $1
    returning id
    `,
    [userId, safePath],
  );
}
