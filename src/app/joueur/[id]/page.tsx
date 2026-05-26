import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { ContentCard } from "@/components/content-card";
import { PageShell } from "@/components/page-shell";
import { PlacementProgress } from "@/components/placement-progress";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getPlayerPublicProfile,
  placementLabel,
} from "@/lib/player-profile";
import { isPlacementComplete } from "@/lib/ranked";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatEloDelta(d: number): string {
  if (d > 0) return `+${d}`;
  return String(d);
}

export default async function JoueurProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getPlayerPublicProfile(id);
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const isMe = viewer?.id === profile.id;
  const placed = isPlacementComplete(profile.placement_matches_played);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-2xl">
        <BackLink href="/classement" label="Retour au classement" />

        <div className="game-panel relative mt-6 overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-amber-400/35 bg-zinc-950 font-[family-name:var(--font-bebas)] text-2xl tracking-wider text-amber-100 shadow-inner shadow-black/60 sm:h-20 sm:w-20 sm:text-3xl">
                {profile.display_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                {isMe ? (
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.32em] text-amber-400/90">
                    Ton profil
                  </p>
                ) : null}
                <h1 className="truncate font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-white sm:text-4xl">
                  {profile.display_name}
                </h1>
                {profile.roblox_username ? (
                  <p className="mt-1 font-mono text-sm text-amber-200/90">
                    Roblox · @{profile.roblox_username.replace(/^@/, "")}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500">
                    Pseudo Roblox non renseigné
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-600">
                  Membre depuis {formatDate(profile.member_since)}
                </p>
              </div>
            </div>

            <div className="w-full rounded-xl border border-white/10 bg-black/25 p-4 sm:w-44">
              <PlacementProgress
                elo={profile.elo}
                placementMatchesPlayed={profile.placement_matches_played}
              />
              {profile.rank != null && placed ? (
                <p className="mt-3 font-mono text-xs text-zinc-500">
                  Rang ladder ·{" "}
                  <span className="font-semibold text-amber-200/95">
                    #{profile.rank}
                  </span>
                </p>
              ) : (
                <p className="mt-3 font-mono text-xs text-zinc-500">
                  {placementLabel(profile.placement_matches_played)}
                </p>
              )}
            </div>
          </div>
        </div>

        <ContentCard className="mt-6">
          <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wide text-zinc-200">
            STATISTIQUES RANKED
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Duels 1v1 validés sur le site (BO3). Les matchs en cours ou en litige
            ne comptent pas dans le ratio.
          </p>

          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <li className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-center">
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-emerald-300/80">
                Victoires
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-100">
                {profile.stats.wins}
              </p>
            </li>
            <li className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-center">
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-red-300/80">
                Défaites
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-red-100">
                {profile.stats.losses}
              </p>
            </li>
            <li className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-zinc-500">
                Winrate
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-zinc-100">
                {profile.stats.win_rate != null
                  ? `${profile.stats.win_rate}%`
                  : "—"}
              </p>
            </li>
            <li className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-center">
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-amber-300/80">
                Matchs validés
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-100">
                {profile.stats.confirmed}
              </p>
            </li>
          </ul>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-zinc-500">
                Maps gagnées / perdues
              </p>
              <p className="mt-1 font-mono text-lg tabular-nums text-zinc-200">
                {profile.stats.maps_won} – {profile.stats.maps_lost}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-zinc-500">
                Autres matchs
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {profile.stats.pending} en cours · {profile.stats.disputed} litige
                {profile.stats.draws > 0
                  ? ` · ${profile.stats.draws} nul${profile.stats.draws > 1 ? "s" : ""}`
                  : ""}
                {profile.stats.cancelled > 0
                  ? ` · ${profile.stats.cancelled} annulé${profile.stats.cancelled > 1 ? "s" : ""}`
                  : ""}
              </p>
            </div>
          </div>
        </ContentCard>

        <ContentCard className="mt-6">
          <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wide text-zinc-200">
            DERNIERS MATCHS
          </h2>
          {profile.recent_matches.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              Aucun match ranked validé pour l&apos;instant.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {profile.recent_matches.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">
                      vs {m.opponent_label}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-zinc-500">
                      {formatDate(m.created_at)} ·{" "}
                      {m.source === "queue" ? "Matchmaking" : "Défi"} ·{" "}
                      {m.maps_won}–{m.maps_lost}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.elo_delta != null ? (
                      <span
                        className={`font-mono text-xs tabular-nums ${
                          m.elo_delta >= 0
                            ? "text-emerald-400/95"
                            : "text-red-400/95"
                        }`}
                      >
                        {formatEloDelta(m.elo_delta)} ELO
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider ${
                        m.outcome === "win"
                          ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-200"
                          : m.outcome === "loss"
                            ? "border-red-500/35 bg-red-500/15 text-red-200"
                            : "border-zinc-600/40 bg-zinc-800/50 text-zinc-400"
                      }`}
                    >
                      {m.outcome === "win"
                        ? "Victoire"
                        : m.outcome === "loss"
                          ? "Défaite"
                          : "Nul"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ContentCard>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/classement"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
          >
            Classement
          </Link>
          {isMe ? (
            <Link
              href="/play"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-4 text-sm font-bold text-zinc-950 transition hover:from-amber-300 hover:to-amber-500"
            >
              Jouer
            </Link>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
