import Link from "next/link";
import { redirect } from "next/navigation";
import { listMatchHistory, type OngoingMatchRow } from "@/app/play/actions";
import { getCurrentUser } from "@/lib/auth/session";

function opponentDisplayName(row: OngoingMatchRow, viewerId: string): string {
  const raw =
    row.player_a === viewerId ? row.player_b_label : row.player_a_label;
  const t = raw?.trim();
  return t && t.length > 0 ? t : "Adversaire";
}

function sourceBadge(source: string): string {
  return source === "queue" ? "Matchmaking" : "Défi ouvert";
}

function statusMeta(row: OngoingMatchRow): {
  label: string;
  sub?: string;
  tone: "emerald" | "amber" | "zinc";
} {
  if (isConfirmedStatus(row.status)) {
    return { label: "Clôturé", tone: "emerald" };
  }
  if (row.status === "cancelled") {
    return {
      label: "Annulé",
      sub: "Sans résultat ranked",
      tone: "zinc",
    };
  }
  if (row.status === "disputed" || row.dispute) {
    return {
      label: "Litige",
      sub: "En attente de résolution",
      tone: "amber",
    };
  }
  return { label: "En cours", sub: "Match non terminé", tone: "amber" };
}

function consensusScore(row: OngoingMatchRow): { a: number; b: number } | null {
  const aa = row.claim_from_a_maps_a;
  const ab = row.claim_from_a_maps_b;
  const ba = row.claim_from_b_maps_a;
  const bb = row.claim_from_b_maps_b;
  if (aa == null || ab == null || ba == null || bb == null) return null;
  if (aa !== ba || ab !== bb) return null;
  return { a: aa, b: ab };
}

function isConfirmedStatus(status: string | null | undefined): boolean {
  return String(status ?? "").toLowerCase() === "confirmed";
}

function resultForViewer(
  row: OngoingMatchRow,
  viewerId: string,
): "win" | "loss" | null {
  if (!isConfirmedStatus(row.status)) return null;
  const s = consensusScore(row);
  if (!s) return null;
  const isA = row.player_a === viewerId;
  if (s.a > s.b) return isA ? "win" : "loss";
  if (s.b > s.a) return isA ? "loss" : "win";
  return null;
}

/** Variation de LP (ELO) pour le joueur connecté sur un match clôturé. */
function lpDeltaForViewer(
  row: OngoingMatchRow,
  viewerId: string,
): number | null {
  if (!isConfirmedStatus(row.status)) return null;
  const raw = row.player_a === viewerId ? row.elo_delta_a : row.elo_delta_b;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const toneClasses = {
  emerald:
    "border-emerald-500/35 bg-emerald-500/10 text-emerald-100/95",
  amber: "border-amber-500/35 bg-amber-500/10 text-amber-100/95",
  zinc: "border-zinc-600/40 bg-zinc-800/40 text-zinc-300",
} as const;

export default async function MesRencontresPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/play/mes-rencontres");

  const { rows } = await listMatchHistory(100);

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="relative border-b border-amber-500/15 pb-8 pl-1 sm:pb-10 sm:pl-2">
        <div className="pointer-events-none absolute left-0 top-0 h-9 w-1 rounded-full bg-gradient-to-b from-amber-400/90 to-amber-800/30 sm:h-11" />
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.4em] text-amber-500/75">
          Historique
        </p>
        <h1 className="game-title mt-3 font-[family-name:var(--font-bebas)] text-4xl tracking-[0.12em] text-white sm:mt-4 sm:text-5xl md:text-6xl">
          MES RENCONTRES
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:mt-5 sm:text-[0.95rem]">
          Toutes tes parties ranked récentes : résultats,{" "}
          <strong className="font-medium text-zinc-300">LP gagnées ou perdues</strong>{" "}
          après clôture, annulations et matchs encore ouverts. Clique sur une
          ligne pour ouvrir la salle de rencontre. En litige, joins des captures
          ou extraits de ton{" "}
          <strong className="font-medium text-zinc-300">enregistrement du combat</strong>{" "}
          au ticket modération.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="game-panel rounded-2xl border border-dashed border-zinc-700/80 px-6 py-14 text-center">
          <p className="font-mono text-sm text-zinc-400">
            Aucune rencontre enregistrée pour l&apos;instant.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Lance un défi ou la recherche matchmaking pour remplir cet historique.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/play/defis"
              className="game-btn-primary inline-flex px-6 py-3 font-[family-name:var(--font-bebas)] text-lg tracking-wide text-zinc-950"
            >
              <span>Défis</span>
            </Link>
            <Link
              href="/play/recherche"
              className="game-btn-ghost inline-flex px-6 py-3 font-[family-name:var(--font-bebas)] text-lg tracking-wide text-amber-50"
            >
              <span>Recherche</span>
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3 sm:space-y-4">
          {rows.map((row) => {
            const opp = opponentDisplayName(row, user.id);
            const meta = statusMeta(row);
            const score = consensusScore(row);
            const outcome = resultForViewer(row, user.id);
            const lpDelta = lpDeltaForViewer(row, user.id);
            const when = new Date(row.created_at).toLocaleString("fr-FR", {
              dateStyle: "medium",
              timeStyle: "short",
            });

            return (
              <li key={row.id}>
                <Link
                  href={`/play/match/${row.id}`}
                  className="game-panel group flex flex-col gap-4 rounded-2xl px-4 py-4 transition hover:border-amber-500/30 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6 sm:px-6 sm:py-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-wider ${toneClasses[meta.tone]}`}
                      >
                        {meta.label}
                      </span>
                      <span className="rounded border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-zinc-400">
                        {sourceBadge(row.source)}
                      </span>
                      {outcome === "win" ? (
                        <span className="rounded border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-wider text-emerald-200/95">
                          Victoire
                        </span>
                      ) : outcome === "loss" ? (
                        <span className="rounded border border-zinc-600/50 bg-zinc-900/60 px-2 py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-wider text-zinc-400">
                          Défaite
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-white sm:text-3xl">
                      vs {opp}
                    </p>
                    <p className="mt-1 font-mono text-xs text-zinc-500">{when}</p>
                    {meta.sub ? (
                      <p className="mt-1 text-sm text-zinc-500">{meta.sub}</p>
                    ) : null}
                    {score ? (
                      <p className="mt-2 font-mono text-sm tabular-nums text-zinc-300">
                        Score (A — B) :{" "}
                        <span className="text-white">
                          {score.a} — {score.b}
                        </span>
                      </p>
                    ) : null}
                    {!score && row.status === "pending" && !row.dispute ? (
                      <p className="mt-2 text-sm text-zinc-500">
                        Déclarations ou étapes en cours…
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-center gap-2 border-t border-white/5 pt-3 sm:border-t-0 sm:pt-0">
                    {isConfirmedStatus(row.status) && lpDelta != null ? (
                      <p
                        className={`font-mono text-lg font-bold tabular-nums sm:text-xl ${
                          lpDelta >= 0
                            ? "text-emerald-400/95"
                            : "text-rose-300/95"
                        }`}
                      >
                        {lpDelta >= 0 ? "+" : ""}
                        {lpDelta} LP
                      </p>
                    ) : isConfirmedStatus(row.status) ? (
                      <p className="max-w-[10rem] text-right font-mono text-[0.65rem] leading-tight text-zinc-500 sm:max-w-[12rem]">
                        LP : — (non enregistré)
                      </p>
                    ) : null}
                    <span className="font-mono text-xs uppercase tracking-wider text-amber-500/80 group-hover:text-amber-400">
                      Ouvrir →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
        <Link
          href="/play/recherche#rencontres-en-cours"
          className="font-mono text-xs uppercase tracking-wider text-amber-500/80 hover:text-amber-400"
        >
          Rencontres en cours
        </Link>
        <span className="text-zinc-700">|</span>
        <Link
          href="/play"
          className="font-mono text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
        >
          ← QG
        </Link>
      </div>
    </div>
  );
}
