"use client";

import { useEffect, useState } from "react";

export function MatchCheatRulesPopup({ matchId }: { matchId: string }) {
  const [open, setOpen] = useState(true);

  // On le redéclenche à chaque changement de match (navigation entre matchs).
  useEffect(() => {
    setOpen(true);
  }, [matchId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Règles anti-cheat"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label="Fermer"
        onClick={() => setOpen(false)}
      />

      <div className="relative w-full max-w-xl rounded-2xl border border-amber-500/35 bg-zinc-950/90 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.7)] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-300/95">
              Anti-cheat / Sanctions
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-white sm:text-4xl">
              Cheats interdits
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200 transition hover:bg-white/[0.08]"
            aria-label="Fermer"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/20 px-4 py-4">
          <p className="text-sm leading-relaxed text-zinc-200">
            Un ban est possible si des triches sont détectées. Respecte les règles
            suivantes :
          </p>
          <ul className="space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>V4 (interdit)</li>
            <li>no heal (interdit)</li>
            <li>mob (interdit)</li>
            <li>no macro (interdit)</li>
            <li>flash tep / flash step (interdit)</li>
            <li>tout autre cheat (interdit)</li>
          </ul>
          <p className="text-sm font-medium text-amber-200/95">
            Sous peine de ban.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="game-btn-primary px-6 py-3"
          >
            J’ai compris
          </button>
        </div>
      </div>
    </div>
  );
}

