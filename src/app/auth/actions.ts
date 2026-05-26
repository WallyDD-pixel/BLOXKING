"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthActionState } from "@/lib/auth-state";
import { createClient } from "@/lib/supabase/server";

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
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "E-mail ou mot de passe incorrect.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme ton e-mail avant de te connecter (lien reçu dans ta boîte).";
  }
  return message;
}

function isEmailAlreadyRegistered(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("user already registered") ||
    m.includes("already registered") ||
    m.includes("email address is already") ||
    m.includes("email already exists") ||
    m.includes("already been registered") ||
    m.includes("duplicate key value") ||
    m.includes("unique constraint")
  );
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
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        roblox_username: robloxUsername,
        display_name: robloxUsername,
      },
    },
  });

  if (error) {
    if (isEmailAlreadyRegistered(error.message)) {
      return {
        error:
          "Un compte existe déjà avec cet e-mail — tu t’es peut-être déjà inscrit. Utilise la connexion avec le même e-mail et le même mot de passe.",
        success: null,
        hint: "use_login",
      };
    }
    return { error: mapAuthError(error.message), success: null };
  }

  if (data.session) {
    redirect("/play");
  }

  return {
    error: null,
    success:
      "Compte créé. Si la confirmation e-mail est activée sur ton projet Supabase, vérifie ta boîte et clique sur le lien.",
  };
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: mapAuthError(error.message), success: null };
  }

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
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
