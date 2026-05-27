"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthActionState } from "@/lib/auth-state";
import { dbQueryOne } from "@/lib/db/query";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

const signupSchema = z
  .object({
    email: z.string().email("Adresse e-mail invalide"),
    password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
    confirmPassword: z.string(),
    robloxUsername: z
      .string()
      .trim()
      .min(2, "Le pseudo Roblox doit faire au moins 2 caractères")
      .max(32, "32 caractères maximum")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Lettres, chiffres et underscore uniquement",
      ),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

function mapAuthError(message: string): string {
  if (/joindre la base|DATABASE_URL|ECONNREFUSED|connect/i.test(message)) {
    return "Le serveur ne peut pas accéder à la base de données pour le moment. Réessaie plus tard ou contacte l’administrateur.";
  }
  return message;
}

function isEmailAlreadyRegistered(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("unique") || m.includes("duplicate") || m.includes("exists");
}

export async function signup(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    robloxUsername: formData.get("robloxUsername"),
  });

  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.email?.[0] ??
      first.password?.[0] ??
      first.confirmPassword?.[0] ??
      first.robloxUsername?.[0] ??
      "Données invalides";
    return { error: msg, success: null };
  }

  const { email, password, robloxUsername } = parsed.data;
  const origin = await getOrigin(); // conservé (emails possibles plus tard)
  void origin;

  let row: { id: string } | null;
  try {
    const passwordHash = await hashPassword(password);
    row = await dbQueryOne<{ id: string }>(
      `
      insert into public.users (email, password_hash, roblox_username, display_name)
      values ($1, $2, $3, $4)
      returning id
      `,
      [email.toLowerCase(), passwordHash, robloxUsername, robloxUsername],
    );
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Erreur";
    if (isEmailAlreadyRegistered(msg)) {
      return {
        error:
          "Un compte existe déjà avec cet e-mail — tu t’es peut-être déjà inscrit. Utilise la connexion avec le même e-mail et le même mot de passe.",
        success: null,
        hint: "use_login",
      };
    }
    return { error: mapAuthError(msg), success: null };
  }

  if (!row?.id) return { error: "Impossible de créer le compte.", success: null };
  await createSession(row.id);
  redirect("/play");
}

export async function login(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = first.email?.[0] ?? first.password?.[0] ?? "Données invalides";
    return { error: msg, success: null };
  }

  const email = parsed.data.email.toLowerCase();

  let row: {
    id: string;
    password_hash: string;
    banned_at: string | null;
  } | null;
  try {
    row = await dbQueryOne<{
      id: string;
      password_hash: string;
      banned_at: string | null;
    }>(
      `select id, password_hash, banned_at from public.users where email = $1`,
      [email],
    );
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: string }).message)
        : "Erreur base de données";
    return { error: mapAuthError(msg), success: null };
  }

  if (!row) return { error: "E-mail ou mot de passe incorrect.", success: null };
  const ok = await verifyPassword(parsed.data.password, row.password_hash);
  if (!ok) return { error: "E-mail ou mot de passe incorrect.", success: null };
  if (row.banned_at) {
    return {
      error:
        "Ce compte est suspendu. Contacte la modération si tu penses qu’il s’agit d’une erreur.",
      success: null,
    };
  }

  await createSession(row.id);

  const next = formData.get("next");
  if (
    typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//")
  ) {
    redirect(next);
  }

  redirect("/play");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}
