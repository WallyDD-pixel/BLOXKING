import Link from "next/link";
import { expireStaleMatchesIfNeeded } from "@/lib/match/expire-stale-matches";
import { listAdminMatches } from "@/lib/admin/queries";
import {
  formatScore,
  matchStatusClass,
  matchStatusLabel,
} from "@/lib/admin/display";
import { deriveAdminMatchProgress } from "@/lib/admin/match-progress";
import { AdminMatchProgressBadge } from "@/components/admin/admin-match-progress";
import { TableSearchBar } from "@/components/table-search-bar";
import { formatDateTimeFr } from "@/lib/format-datetime";
import { searchBlob } from "@/lib/table-search";

const FILTERS = [
  { value: "all", label: "Tous" },
  { value: "pending", label: "En cours" },
  { value: "disputed", label: "Litige" },
  { value: "confirmed", label: "Terminés" },
  { value: "cancelled", label: "Annulés" },
];

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = rawStatus?.trim() || "all";
  await expireStaleMatchesIfNeeded();
  const rows = await listAdminMatches({
    status: status === "all" ? undefined : status,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={
              f.value === "all" ? "/admin/matchs" : `/admin/matchs?status=${f.value}`
            }
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              status === f.value
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <TableSearchBar
        targetId="admin-matchs-table"
        totalCount={rows.length}
        placeholder="Rechercher joueur, e-mail, score, statut, ID…"
      />

      <div
        id="admin-matchs-table"
        className="overflow-x-auto rounded-xl border border-white/10"
      >
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-white/10 bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Joueurs</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Étape / progression</th>
              <th className="px-4 py-3 font-medium">Statut DB</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  Aucun match.
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const progress = deriveAdminMatchProgress(m);
                const scoreStr = formatScore(
                  m.claim_from_a_maps_a,
                  m.claim_from_a_maps_b,
                  m.claim_from_b_maps_a,
                  m.claim_from_b_maps_b,
                );
                return (
                <tr
                  key={m.id}
                  className="hover:bg-white/[0.02]"
                  data-search={searchBlob(
                    m.id,
                    m.player_a_label,
                    m.player_b_label,
                    m.status,
                    matchStatusLabel(m.status, m.dispute),
                    progress.phaseLabel,
                    progress.summary,
                    scoreStr,
                    m.source === "queue" ? "file matchmaking" : "défi",
                    m.cancel_reason,
                    m.ticket_count,
                    m.cancel_request_count,
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                    {formatDateTimeFr(m.created_at, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-zinc-200">
                      {m.player_a_label ?? m.player_a_email}
                    </p>
                    <p className="text-zinc-500">vs</p>
                    <p className="text-zinc-200">
                      {m.player_b_label ?? m.player_b_email}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-300">
                    {formatScore(
                      m.claim_from_a_maps_a,
                      m.claim_from_a_maps_b,
                      m.claim_from_b_maps_a,
                      m.claim_from_b_maps_b,
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <AdminMatchProgressBadge progress={progress} />
                    <p className="mt-1.5 font-mono text-[0.65rem] text-zinc-600">
                      A {m.match_started_a ? "✓" : "·"} début · B{" "}
                      {m.match_started_b ? "✓" : "·"} début
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${matchStatusClass(m.status, m.dispute)}`}
                    >
                      {matchStatusLabel(m.status, m.dispute)}
                    </span>
                    {m.ticket_count > 0 ? (
                      <p className="mt-1 text-xs text-amber-500/90">
                        {m.ticket_count} ticket(s)
                      </p>
                    ) : null}
                    {m.cancel_request_count > 0 ? (
                      <p className="mt-1 text-xs font-semibold text-red-400/90">
                        {m.cancel_request_count} demande(s) annulation
                      </p>
                    ) : null}
                    {m.player_chat_count > 0 ? (
                      <p className="mt-1 text-xs text-emerald-500/90">
                        {m.player_chat_count} msg. joueurs
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {m.source === "queue" ? "File" : "Défi"}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <Link
                      href={`/admin/litiges/${m.id}`}
                      className="text-amber-400 hover:text-amber-300"
                    >
                      Détail
                    </Link>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
