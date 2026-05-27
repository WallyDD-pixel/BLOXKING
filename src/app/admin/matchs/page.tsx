import Link from "next/link";
import { listAdminMatches } from "@/lib/admin/queries";
import {
  formatScore,
  matchStatusClass,
  matchStatusLabel,
} from "@/lib/admin/display";

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

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/10 bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Joueurs</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Aucun match.
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                    {new Date(m.created_at).toLocaleString("fr-FR", {
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
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {m.source === "queue" ? "File" : "Défi"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(m.dispute || m.status === "disputed") && (
                      <Link
                        href={`/admin/litiges/${m.id}`}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        Modérer
                      </Link>
                    )}
                    {m.status === "pending" && !m.dispute ? (
                      <Link
                        href={`/admin/litiges/${m.id}`}
                        className="text-zinc-400 hover:text-zinc-200"
                      >
                        Détail
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
