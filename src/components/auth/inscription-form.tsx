"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/auth/actions";
import { authInitialState } from "@/lib/auth-state";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30";

const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500";

export function InscriptionForm() {
  const [state, formAction, isPending] = useActionState(signup, authInitialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="robloxUsername" className={labelClass}>
          Pseudo Roblox
        </label>
        <input
          id="robloxUsername"
          name="robloxUsername"
          type="text"
          autoComplete="username"
          required
          maxLength={32}
          className={inputClass}
          placeholder="TonPseudo"
        />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
          placeholder="toi@exemple.com"
        />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
          placeholder="Au moins 8 caractères"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className={labelClass}>
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </div>

      {state.error ? (
        <div
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
          role="alert"
        >
          <p>{state.error}</p>
          {state.hint === "use_login" ? (
            <p className="mt-2 border-t border-red-500/20 pt-2 text-zinc-300">
              <Link
                href="/connexion"
                className="font-semibold text-amber-400 underline-offset-2 hover:text-amber-300 hover:underline"
              >
                Ouvrir la page Connexion
              </Link>
              <span className="text-zinc-500"> — même e-mail, même mot de passe.</span>
            </p>
          ) : null}
        </div>
      ) : null}
      {state.success ? (
        <p
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
          role="status"
        >
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-900/30 transition enabled:hover:from-amber-300 enabled:hover:to-amber-500 disabled:opacity-50"
      >
        {isPending ? "Création…" : "Créer mon compte"}
      </button>
    </form>
  );
}
