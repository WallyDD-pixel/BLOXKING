"use client";

import { useActionState } from "react";
import { login } from "@/app/auth/actions";
import { authInitialState } from "@/lib/auth-state";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30";

const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500";

type ConnexionFormProps = {
  callbackError?: boolean;
  /** Redirection après connexion (ex. /play) */
  redirectTo?: string;
};

export function ConnexionForm({
  callbackError,
  redirectTo,
}: ConnexionFormProps) {
  const [state, formAction, isPending] = useActionState(login, authInitialState);

  return (
    <form action={formAction} className="space-y-4">
      {redirectTo ? (
        <input type="hidden" name="next" value={redirectTo} />
      ) : null}
      {callbackError ? (
        <p
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          Lien de confirmation invalide ou expiré. Réessaie depuis l’e-mail ou
          connecte-toi.
        </p>
      ) : null}
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
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      {state.error ? (
        <p
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-900/30 transition enabled:hover:from-amber-300 enabled:hover:to-amber-500 disabled:opacity-50"
      >
        {isPending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
