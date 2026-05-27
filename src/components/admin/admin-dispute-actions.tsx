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
};

export function AdminDisputeActions({ matchId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mapsA, setMapsA] = useState("2");
  const [mapsB, setMapsB] = useState("0");
  const [message, setMessage] = useState<string | null>(null);

  const closed = status === "confirmed" || status === "cancelled";

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
      {closed ? (
        <p className="mt-2 text-sm text-zinc-500">Match déjà clôturé.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm text-zinc-400">
              Score BO3 (joueur A)
              <input
                type="number"
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
                min={0}
                max={2}
                value={mapsB}
                onChange={(e) => setMapsB(e.target.value)}
                className="mt-1 block w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <button
              type="button"
              disabled={pending}
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
