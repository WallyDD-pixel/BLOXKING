"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adminCancelMatch,
  adminResetDispute,
  adminResolveMatch,
} from "@/app/admin/actions";

type Props = {
  matchId: string;
  status: string;
  playerALabel: string;
  playerBLabel: string;
  openCancellationCount?: number;
};

export function AdminDisputeActions({
  matchId,
  status,
  playerALabel,
  playerBLabel,
  openCancellationCount = 0,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mapsA, setMapsA] = useState("2");
  const [mapsB, setMapsB] = useState("0");
  const [message, setMessage] = useState<string | null>(null);

  const closed = status === "confirmed" || status === "cancelled";
  const a = Number(mapsA);
  const b = Number(mapsB);
  const bo3Valid =
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    a >= 0 &&
    b >= 0 &&
    a <= 2 &&
    b <= 2 &&
    Math.max(a, b) === 2 &&
    a + b <= 3;

  const winner =
    bo3Valid && a !== b ? (a > b ? playerALabel : playerBLabel) : null;

  function run(action: () => Promise<{ ok?: true; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) setMessage(res.error);
      else {
        setMessage("OK");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
      <h3 className="font-semibold text-zinc-100">Actions modération</h3>
      {openCancellationCount > 0 ? (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {openCancellationCount} demande(s) d&apos;annulation en attente — voir
          ci-dessous pour les raisons.
        </p>
      ) : null}
      {closed ? (
        <p className="mt-2 text-sm text-zinc-500">Match déjà clôturé.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm text-zinc-400">
              Score BO3 (joueur A)
              <input
                type="number"
                step={1}
                min={0}
                max={2}
                value={mapsA}
                onChange={(e) => setMapsA(e.target.value)}
                className="mt-1 block w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <label className="text-sm text-zinc-400">
              Score (joueur B)
              <input
                type="number"
                step={1}
                min={0}
                max={2}
                value={mapsB}
                onChange={(e) => setMapsB(e.target.value)}
                className="mt-1 block w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <button
              type="button"
              disabled={pending || !bo3Valid}
              onClick={() =>
                run(() =>
                  adminResolveMatch(
                    matchId,
                    Number(mapsA),
                    Number(mapsB),
                  ),
                )
              }
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Valider le score
            </button>
          </div>
          <div className="mt-3 text-sm">
            <span className="text-zinc-500">Prévision :</span>{" "}
            {bo3Valid && winner ? (
              <span className="font-semibold text-emerald-200">
                {winner} gagne ({a}-{b})
              </span>
            ) : (
              <span className="text-zinc-500">
                BO3 invalide (doit être 2-0, 2-1, 0-2 ou 1-2).
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => adminResetDispute(matchId))}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
            >
              Réinitialiser le litige
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => adminCancelMatch(matchId))}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-50"
            >
              Annuler le match
            </button>
          </div>
        </>
      )}
      {message ? (
        <p
          className={`mt-3 text-sm ${message === "OK" ? "text-emerald-400" : "text-red-400"}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
