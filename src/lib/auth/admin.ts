import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { dbQueryOne } from "@/lib/db/query";

function adminEmailsFromEnv(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Accès admin : colonne `is_admin` ou email listé dans ADMIN_EMAILS. */
export async function userIsAdmin(user: SessionUser): Promise<boolean> {
  const emails = adminEmailsFromEnv();
  if (emails.has(user.email.toLowerCase())) return true;

  try {
    const row = await dbQueryOne<{ is_admin: boolean }>(
      `select coalesce(is_admin, false) as is_admin from public.users where id = $1`,
      [user.id],
    );
    return row?.is_admin === true;
  } catch {
    return emails.size > 0 && emails.has(user.email.toLowerCase());
  }
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/admin");
  if (!(await userIsAdmin(user))) redirect("/");

  const emails = adminEmailsFromEnv();
  if (emails.has(user.email.toLowerCase())) {
    try {
      await dbQueryOne(
        `update public.users set is_admin = true where id = $1 and not is_admin returning id`,
        [user.id],
      );
    } catch {
      /* colonne is_admin absente tant que db/03_admin.sql n’est pas appliquée */
    }
  }

  return user;
}
