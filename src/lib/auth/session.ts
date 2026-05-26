import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { dbQueryOne } from "@/lib/db/query";

export const SESSION_COOKIE = "bk_session";

export type SessionUser = {
  id: string;
  email: string;
  roblox_username: string | null;
  display_name: string | null;
};

function newToken(): string {
  return randomBytes(32).toString("hex");
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? null;
  if (!token) return null;

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
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
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
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

