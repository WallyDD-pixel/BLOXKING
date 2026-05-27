import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { dbQueryOne } from "@/lib/db/query";
import { recordUserPresence } from "@/lib/presence/record";

export const SESSION_COOKIE = "bk_session";

export type SessionUser = {
  id: string;
  email: string;
  roblox_username: string | null;
  display_name: string | null;
};

function cookieSecureFlag(): boolean {
  const explicit = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  if (process.env.NODE_ENV !== "production") return false;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().toLowerCase() ?? "";
  return site.startsWith("https://");
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? null;
  if (!token) return null;

  try {
    const row = await dbQueryOne<SessionUser>(
      `
      select
        u.id,
        u.email,
        u.roblox_username,
        u.display_name
      from public.sessions s
      join public.users u on u.id = s.user_id
      where s.token = $1
        and s.expires_at > now()
      `,
      [token],
    );
    return row ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ECONNREFUSED|connect|joindre PostgreSQL/i.test(msg)) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[auth] PostgreSQL indisponible — session ignorée (tunnel SSH ?)");
      }
      return null;
    }
    throw e;
  }
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  const token = newToken();

  await dbQueryOne(
    `
    insert into public.sessions (token, user_id, expires_at)
    values ($1, $2, now() + interval '30 days')
    returning token
    `,
    [token, userId],
  );

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecureFlag(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  void recordUserPresence(userId, "/").catch(() => null);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? null;
  if (token) {
    await dbQueryOne("delete from public.sessions where token = $1 returning token", [token]);
  }
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecureFlag(),
    path: "/",
    maxAge: 0,
  });
}

