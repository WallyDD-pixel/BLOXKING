"use client";

import Link from "next/link";

/** Lien principal pour quitter la salle de rencontre vers la liste des matchs actifs. */
export function MatchBackToList() {
  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 backdrop-blur-sm sm:px-5">
      <Link
        href="/play/recherche#rencontres-en-cours"
        className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/95 transition hover:text-amber-300"
      >
        <span aria-hidden>←</span>
        <span>Retour à la recherche (liste en bas)</span>
      </Link>
      <p className="mt-2 text-[0.7rem] leading-relaxed text-zinc-500 sm:text-xs">
        La liste des matchs non terminés est sous la zone de recherche
        (Matchmaking). Le bouton retour du navigateur peut encore renvoyer vers
        une autre page — ce lien ramène à la recherche avec la liste.
      </p>
    </div>
  );
}
