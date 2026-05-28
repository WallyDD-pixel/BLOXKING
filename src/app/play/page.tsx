import Link from "next/link";
import { BlameStatusBanner } from "@/components/blame-status-banner";
import { PlacementProgress } from "@/components/placement-progress";
import { PvpDisabledBanner } from "@/components/pvp-disabled-banner";
import { YoutubeLiveBadge } from "@/components/youtube-live-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { dbQueryOne } from "@/lib/db/query";
import { getPvpEnabled } from "@/lib/site/pvp";
import { FINAL_PRIZE_ROBUX, FINALIST_COUNT } from "@/lib/competition-copy";
import { DEFAULT_ELO } from "@/lib/ranked";

export default async function PlayHomePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const display =
    user.roblox_username ?? user.display_name ?? user.email.split("@")[0];

  const initial = (display ?? "?").slice(0, 2).toUpperCase();

  const rankedRow = await dbQueryOne<{
    elo: number;
    placement_matches_played: number;
    blame_active: boolean;
    blame_fair_wins_done: number;
    blame_fair_wins_required: number;
  }>(
    `
    select
      elo,
      placement_matches_played,
      coalesce(blame_active, false) as blame_active,
      coalesce(blame_fair_wins_done, 0) as blame_fair_wins_done,
      coalesce(blame_fair_wins_required, 0) as blame_fair_wins_required
    from public.player_ranked_stats
    where user_id = $1
    `,
    [user.id],
  );

  const placementMatchesPlayed = rankedRow?.placement_matches_played ?? 0;
  const elo = rankedRow?.elo ?? DEFAULT_ELO;
  const blameActive = rankedRow?.blame_active ?? false;
  const pvpEnabled = await getPvpEnabled();

  return (
    <div className="space-y-10">
      {blameActive ? (
        <BlameStatusBanner
          fairWinsDone={rankedRow?.blame_fair_wins_done ?? 0}
          fairWinsRequired={rankedRow?.blame_fair_wins_required ?? 0}
        />
      ) : null}
      <div className="game-panel relative overflow-hidden rounded-xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-amber-500/8 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-amber-500/35 to-amber-600/20 opacity-80 blur-sm" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-xl border-2 border-amber-400/40 bg-zinc-950 font-[family-name:var(--font-bebas)] text-3xl tracking-wider text-amber-100 shadow-inner shadow-black/60">
                {initial}
              </div>
            </div>
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.35em] text-amber-500/75">
                Pilote connecté
              </p>
              <h1 className="game-title game-glitch-text font-[family-name:var(--font-bebas)] text-4xl tracking-[0.08em] text-white sm:text-5xl">
                {display}
              </h1>
              <div className="mt-3">
                <YoutubeLiveBadge />
              </div>
              <p className="mt-1 font-mono text-xs text-zinc-500">
                ID session · {user.id.slice(0, 8)}…
              </p>
            </div>
          </div>

          <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/25 p-4 lg:w-80 lg:p-5">
            <PlacementProgress
              elo={elo}
              placementMatchesPlayed={placementMatchesPlayed}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4 sm:px-5 sm:py-5">
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-amber-400/90">
          Objectif compétition
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300 sm:text-[0.95rem]">
          Enchaîne les duels <strong className="text-zinc-100">1v1</strong> classés
          pour entrer dans le{" "}
          <strong className="text-amber-100/95">top {FINALIST_COUNT}</strong> du site
          et jouer la finale —{" "}
          <strong className="text-amber-100/95">
            {FINAL_PRIZE_ROBUX.toLocaleString("fr-FR")} Robux
          </strong>{" "}
          pour le vainqueur.
        </p>
      </div>

      <div>
        <h2 className="mb-4 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-amber-500/65">
          Matchmaking
        </h2>
        <div className="game-panel rounded-xl p-6 sm:p-8">
          <div className="mb-3 inline-flex rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-amber-400/95">
            PvP 1v1
          </div>
          <h3 className="font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-white">
            RECHERCHE CLASSÉE
          </h3>
          {pvpEnabled ? (
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-zinc-500">
              Lance la file matchmaking : le système te jumelle au prochain joueur
              en attente pour un duel BO3 classé.
            </p>
          ) : (
            <div className="mt-4">
              <PvpDisabledBanner />
            </div>
          )}
          {pvpEnabled ? (
            <Link
              href="/play/recherche"
              className="game-btn-primary mt-6 inline-block px-6 py-3 font-[family-name:var(--font-bebas)] text-lg tracking-wide text-zinc-950"
            >
              <span>Lancer la recherche</span>
            </Link>
          ) : (
            <p className="mt-6 font-mono text-xs uppercase tracking-wider text-zinc-600">
              Recherche indisponible
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
        <Link
          href="/play/mes-rencontres"
          className="font-mono text-xs uppercase tracking-wider text-amber-500/80 hover:text-amber-400"
        >
          Historique rencontres
        </Link>
        <span className="text-zinc-700">|</span>
        <Link
          href="/play/recherche#rencontres-en-cours"
          className="font-mono text-xs uppercase tracking-wider text-amber-500/80 hover:text-amber-400"
        >
          Recherche (liste)
        </Link>
        <span className="text-zinc-700">|</span>
        <Link
          href="/classement"
          className="font-mono text-xs uppercase tracking-wider text-zinc-500 underline-offset-4 hover:text-amber-400/85 hover:underline"
        >
          Classement public
        </Link>
        <span className="text-zinc-700">|</span>
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
        >
          Quitter le QG
        </Link>
      </div>
    </div>
  );
}
