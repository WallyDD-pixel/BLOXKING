"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listOngoingMatches, type OngoingMatchRow } from "@/app/play/actions";
import { TableSearchBar } from "@/components/table-search-bar";
import { deriveOngoingMatchCardState } from "@/lib/match-list-state";
import { isPlacementComplete, PLACEMENT_TOTAL } from "@/lib/ranked";
import { searchBlob } from "@/lib/table-search";

function sourceLabel(source: string): string {
  return source === "queue" ? "Matchmaking" : "Défi";
}

export function OngoingMatchesBlock({
  userId,
  initialRows,
  placementMatchesPlayed,
}: {
  userId: string;
  initialRows: OngoingMatchRow[];
  /** Parties de placement déjà jouées (0–5), joueur courant. */
  placementMatchesPlayed: number;
}) {
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    const tick = async () => {
      const { rows: next } = await listOngoingMatches();
      setRows(next);
    };
    const id = setInterval(() => void tick(), 14_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      id="rencontres-en-cours"
      className="scroll-mt-8 border-t border-white/10 pt-8 sm:pt-10"
      aria-labelledby="ongoing-matches-heading"
    >
      <h2
        id="ongoing-matches-heading"
        className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-amber-500/80"
      >
        Rencontres en cours
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
        Matchs non terminés (déclaration ou clôture en attente). Clique pour
        rejoindre la salle. Si tu joues maintenant,{" "}
        <strong className="font-medium text-zinc-400">
          enregistre le combat
        </strong>{" "}
        — preuve utile en cas de litige.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-amber-200/95">
          Placement ranked{" "}
          <span className="tabular-nums text-amber-100">
            {Math.min(placementMatchesPlayed, PLACEMENT_TOTAL)}/{PLACEMENT_TOTAL}
          </span>
        </span>
        {isPlacementComplete(placementMatchesPlayed) ? (
          <span className="text-xs text-emerald-500/85">ELO classé</span>
        ) : (
          <span className="text-xs text-zinc-500">
            K élevé jusqu&apos;à la fin du placement
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-700/90 bg-zinc-950/40 px-5 py-8 text-center">
          <p className="font-mono text-sm text-zinc-500">
            Aucune rencontre en cours.
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Lance une recherche ci-dessus ou un défi depuis l&apos;Arène.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <TableSearchBar
            targetId="ongoing-matches-list"
            totalCount={rows.length}
            placeholder="Rechercher une rencontre en cours…"
          />
          <ul id="ongoing-matches-list" className="space-y-3">
          {rows.map((m) => {
            const isA = m.player_a === userId;
            const oppLabel = isA
              ? m.player_b_label ?? "Joueur B"
              : m.player_a_label ?? "Joueur A";
            const card = deriveOngoingMatchCardState(m);
            const created = new Date(m.created_at);
            const dateStr = created.toLocaleString("fr-FR", {
              dateStyle: "short",
              timeStyle: "short",
            });

            return (
              <li
                key={m.id}
                data-search={searchBlob(
                  m.id,
                  oppLabel,
                  card.badge,
                  card.detail,
                  sourceLabel(m.source),
                  m.status,
                  dateStr,
                )}
              >
                <Link
                  href={`/play/match/${m.id}`}
                  className="game-panel flex flex-col gap-3 rounded-xl p-4 transition hover:border-amber-500/35 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[0.55rem] uppercase tracking-wider text-zinc-600">
                      {sourceLabel(m.source)} · {dateStr}
                    </p>
                    <p className="mt-1 truncate font-[family-name:var(--font-bebas)] text-xl tracking-wide text-white sm:text-2xl">
                      vs {oppLabel}
                    </p>
                    <p className="mt-2 text-sm leading-snug text-zinc-400">
                      {card.detail}
                    </p>
                    <p className="mt-1.5 font-mono text-[0.65rem] text-zinc-600">
                      {m.id.slice(0, 8)}…
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
                    <span
                      className={`max-w-[11rem] rounded-lg border px-2.5 py-1.5 text-center font-mono text-[0.6rem] font-semibold uppercase leading-tight tracking-wider sm:max-w-[14rem] sm:text-[0.65rem] ${card.badgeClass}`}
                    >
                      {card.badge}
                    </span>
                    <span className="font-mono text-xs text-amber-500/90">
                      Ouvrir →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
          </ul>
        </div>
      )}

      <p className="mt-6 text-center">
        <Link
          href="/play/mes-rencontres"
          className="font-mono text-xs uppercase tracking-wider text-amber-500/85 underline-offset-4 hover:text-amber-400 hover:underline"
        >
          Historique complet des rencontres →
        </Link>
      </p>
    </section>
  );
}
