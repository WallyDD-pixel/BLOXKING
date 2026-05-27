import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ContentCard } from "@/components/content-card";
import { PvpRecordingTip } from "@/components/pvp-recording-tip";
import { TournamentHeroBanner } from "@/components/tournament-hero-banner";
import { PageShell } from "@/components/page-shell";
import { YoutubeLiveBadge } from "@/components/youtube-live-badge";
import { getCurrentUser } from "@/lib/auth/session";
import { dbQuery } from "@/lib/db/query";
import { playerDisplayName } from "@/lib/player-display-name";
import {
  FINAL_PRIZE_ROBUX,
  FINALIST_COUNT,
} from "@/lib/competition-copy";
import { PLACEMENT_TOTAL } from "@/lib/ranked";
import { TableSearchBar } from "@/components/table-search-bar";
import { searchBlob } from "@/lib/table-search";

export default async function ClassementPage() {
  const user = await getCurrentUser();

  let list: Array<{
    user_id: string;
    elo: number;
    placement_matches_played: number;
    roblox_username: string | null;
    display_name: string | null;
    email: string;
  }> = [];
  let showError = false;

  try {
    list = await dbQuery(
      `
      select
        s.user_id,
        s.elo,
        s.placement_matches_played,
        u.roblox_username,
        u.display_name,
        u.email
      from public.player_ranked_stats s
      join public.users u on u.id = s.user_id
      order by s.elo desc
      limit 50
      `,
    );
  } catch {
    showError = true;
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl">
        <BackLink />
        <div className="mt-6">
          <TournamentHeroBanner variant="compact" />
        </div>
        <h1 className="mt-8 font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
          CLASSEMENT
        </h1>
        <div className="mt-4">
          <YoutubeLiveBadge />
        </div>
        <p className="mt-4 max-w-xl text-zinc-400">
          Ladder <strong className="font-medium text-zinc-200">1v1</strong> en ELO
          (départ 1000, placement {PLACEMENT_TOTAL} parties). Les{" "}
          <strong className="font-medium text-amber-200/95">
            {FINALIST_COUNT} premiers
          </strong>{" "}
          à la fin de la phase ranked sont qualifiés pour la finale — le vainqueur
          remporte{" "}
          <strong className="font-medium text-amber-200/95">
            {FINAL_PRIZE_ROBUX.toLocaleString("fr-FR")} Robux
          </strong>
          .
        </p>
        <PvpRecordingTip variant="compact" className="mt-6" showFairPlayLink />

        <div className="mt-6 rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-transparent px-4 py-4 sm:px-5">
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-amber-300/95">
            Zone finale · top {FINALIST_COUNT}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Les lignes surlignées correspondent aux places qualificatives. Continue
            à enchaîner les duels 1v1 validés pour sécuriser ta position avant la
            clôture de la saison.
          </p>
        </div>

        <ContentCard className="mt-8">
          {showError ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
              Impossible de charger le classement. Exécute{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">
                db/01_ranked.sql
              </code>{" "}
              sur PostgreSQL.
            </div>
          ) : list.length === 0 ? (
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-300">
                  Aucun joueur classé pour l&apos;instant
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Les ELO apparaîtront après les premiers matchs ranked validés
                  (étape « Terminer et enregistrer »).
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <TableSearchBar
                targetId="classement-table"
                totalCount={list.length}
                placeholder="Rechercher un joueur…"
              />
              <div id="classement-table" className="overflow-x-auto">
              <table className="w-full min-w-[320px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 font-mono text-[0.6rem] uppercase tracking-wider text-zinc-500">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">Joueur</th>
                    <th className="pb-3 pr-4">ELO</th>
                    <th className="pb-3">Placement</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row, i) => {
                    const isMe = user?.id === row.user_id;
                    const rank = i + 1;
                    const isFinalistZone = rank <= FINALIST_COUNT;
                    const name = playerDisplayName(row);
                    return (
                      <tr
                        key={row.user_id}
                        data-search={searchBlob(
                          rank,
                          name,
                          row.email,
                          row.roblox_username,
                          row.display_name,
                          row.elo,
                          row.placement_matches_played,
                        )}
                        className={`border-b border-white/5 font-mono text-zinc-200 ${
                          isFinalistZone
                            ? "bg-amber-500/[0.08] ring-1 ring-inset ring-amber-500/15"
                            : ""
                        } ${isMe ? "bg-amber-500/15" : ""}`}
                      >
                        <td className="py-3 pr-4 tabular-nums">
                          <span
                            className={
                              isFinalistZone
                                ? "font-semibold text-amber-200/95"
                                : "text-zinc-500"
                            }
                          >
                            {rank}
                            {isFinalistZone ? (
                              <span className="ml-1.5 hidden text-[0.55rem] uppercase tracking-wider text-amber-400/80 sm:inline">
                                finale
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Link
                            href={`/joueur/${row.user_id}`}
                            className={`block max-w-[10rem] truncate font-sans underline-offset-2 transition hover:text-amber-300 hover:underline sm:max-w-[14rem] ${
                              isMe
                                ? "font-semibold text-amber-100"
                                : "text-zinc-200"
                            }`}
                            title={isMe ? `${name} (toi) — voir le profil` : `${name} — voir le profil`}
                          >
                            {isMe ? (
                              <>
                                {name}
                                <span className="ml-1.5 text-xs font-normal text-amber-400/90 no-underline">
                                  (toi)
                                </span>
                              </>
                            ) : (
                              name
                            )}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 tabular-nums text-amber-200/95">
                          {row.elo}
                        </td>
                        <td className="py-3 text-zinc-400">
                          {Math.min(row.placement_matches_played, PLACEMENT_TOTAL)}/
                          {PLACEMENT_TOTAL}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </ContentCard>
      </div>
    </PageShell>
  );
}
