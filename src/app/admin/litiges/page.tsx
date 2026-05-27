import Link from "next/link";
import { TableSearchBar } from "@/components/table-search-bar";
import { listAdminDisputes } from "@/lib/admin/queries";
import { matchStatusClass, matchStatusLabel } from "@/lib/admin/display";
import { searchBlob } from "@/lib/table-search";

export default async function AdminDisputesPage() {
  const rows = await listAdminDisputes();

  return (
    <div className="space-y-4">
      {rows.length > 0 ? (
        <TableSearchBar
          targetId="admin-disputes-list"
          totalCount={rows.length}
          placeholder="Rechercher par e-mail, date, tickets…"
        />
      ) : null}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-8 text-center text-zinc-500">
          Aucun litige en cours.
        </p>
      ) : (
        <ul id="admin-disputes-list" className="space-y-3">
          {rows.map((d) => (
            <li
              key={d.match_id}
              data-search={searchBlob(
                d.match_id,
                d.player_a_email,
                d.player_b_email,
                d.status,
                matchStatusLabel(d.status, true),
                d.ticket_count,
                d.chat_count,
                d.created_at,
                d.first_ticket_at,
              )}
            >
              <Link
                href={`/admin/litiges/${d.match_id}`}
                className="block rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 transition hover:border-amber-500/40 hover:bg-amber-500/10"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-100">
                      {d.player_a_email}{" "}
                      <span className="text-zinc-500">vs</span>{" "}
                      {d.player_b_email}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Match du{" "}
                      {new Date(d.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${matchStatusClass(d.status, true)}`}
                  >
                    {matchStatusLabel(d.status, true)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  {d.ticket_count} ticket(s) · {d.chat_count} message(s) chat
                  {d.first_ticket_at
                    ? ` · 1er ticket ${new Date(d.first_ticket_at).toLocaleString("fr-FR")}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
