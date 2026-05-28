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

type StaffFlags = {
  isAdmin: boolean;
  isDisputeModerator: boolean;
};

async function getStaffFlags(userId: string): Promise<StaffFlags> {
  try {
    const row = await dbQueryOne<{
      is_admin: boolean;
      is_dispute_moderator: boolean;
    }>(
      `
      select
        coalesce(is_admin, false) as is_admin,
        coalesce(is_dispute_moderator, false) as is_dispute_moderator
      from public.users
      where id = $1
      `,
      [userId],
    );
    return {
      isAdmin: row?.is_admin === true,
      isDisputeModerator: row?.is_dispute_moderator === true,
    };
  } catch {
    return { isAdmin: false, isDisputeModerator: false };
  }
}

export type AdminPanelAccess = {
  user: SessionUser;
  isFullAdmin: boolean;
  isDisputeModerator: boolean;
};

/** Admin complet (tout le panneau). */
export async function userIsFullAdmin(user: SessionUser): Promise<boolean> {
  const emails = adminEmailsFromEnv();
  if (emails.has(user.email.toLowerCase())) return true;
  const flags = await getStaffFlags(user.id);
  return flags.isAdmin;
}

/** Accès au panneau admin (admin ou modérateur litiges). */
export async function userCanAccessAdminPanel(
  user: SessionUser,
): Promise<boolean> {
  if (await userIsFullAdmin(user)) return true;
  const flags = await getStaffFlags(user.id);
  return flags.isDisputeModerator;
}

/** @deprecated Alias de userIsFullAdmin */
export async function userIsAdmin(user: SessionUser): Promise<boolean> {
  return userIsFullAdmin(user);
}

export async function requireAdminPanel(): Promise<AdminPanelAccess> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/admin");

  const emails = adminEmailsFromEnv();
  if (emails.has(user.email.toLowerCase())) {
    try {
      await dbQueryOne(
        `update public.users set is_admin = true where id = $1 and not is_admin returning id`,
        [user.id],
      );
    } catch {
      /* colonne absente */
    }
  }

  const flags = await getStaffFlags(user.id);
  const isFullAdmin =
    flags.isAdmin || emails.has(user.email.toLowerCase());

  if (!isFullAdmin && !flags.isDisputeModerator) {
    redirect("/");
  }

  return {
    user,
    isFullAdmin,
    isDisputeModerator: flags.isDisputeModerator && !isFullAdmin,
  };
}

/** Admin complet uniquement (utilisateurs, PvP, rôles…). */
export async function requireFullAdmin(): Promise<SessionUser> {
  const access = await requireAdminPanel();
  if (!access.isFullAdmin) redirect("/admin");
  return access.user;
}

/** Litiges + matchs (admin ou modérateur litiges). */
export async function requireDisputeStaff(): Promise<SessionUser> {
  const access = await requireAdminPanel();
  return access.user;
}

/** @deprecated Utiliser requireAdminPanel ou requireFullAdmin */
export async function requireAdmin(): Promise<SessionUser> {
  return (await requireAdminPanel()).user;
}
