"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminSetPvpEnabled } from "@/app/admin/actions";
import { formatDateTimeFr } from "@/lib/format-datetime";

type Props = {
  initialEnabled: boolean;
  updatedAt: string | null;
};

export function AdminPvpToggle({ initialEnabled, updatedAt }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await adminSetPvpEnabled(next);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEnabled(next);
      setMessage(
        next
          ? "PvP activé — les joueurs peuvent lancer une recherche."
          : "PvP désactivé — message affiché aux joueurs.",
      );
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            PvP / matchmaking
          </h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Désactive la recherche classée quand aucun modérateur n’est
            disponible. Les joueurs voient un message explicite ; les matchs en
            cours restent accessibles.
          </p>
          {updatedAt ? (
            <p className="mt-2 text-xs text-zinc-600">
              Dernière modification : {formatDateTimeFr(updatedAt)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              enabled
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-red-500/15 text-red-300"
            }`}
          >
            {enabled ? "Activé" : "Désactivé"}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => toggle()}
            className={`rounded-lg px-5 py-2.5 text-sm font-bold disabled:opacity-50 ${
              enabled
                ? "border border-red-500/40 bg-red-500/15 text-red-100 hover:bg-red-500/25"
                : "border border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {pending
              ? "…"
              : enabled
                ? "Désactiver le PvP"
                : "Activer le PvP"}
          </button>
        </div>
      </div>
      {message ? (
        <p className="mt-4 text-sm text-emerald-400" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
