import Link from "next/link";
import { TableSearchBar } from "@/components/table-search-bar";
import {
  listAdminDisputesClosed,
  listAdminDisputesOpen,
  type AdminDisputeRow,
} from "@/lib/admin/queries";
import { matchStatusClass, matchStatusLabel } from "@/lib/admin/display";
import { labelFromAdminUser } from "@/lib/admin/user-label";
import { formatDateTimeFr } from "@/lib/format-datetime";
import { searchBlob } from "@/lib/table-search";

function decisionSummary(d: AdminDisputeRow): string | null {
  if (d.last_decision_action === "resolve" && d.last_decision_maps_a != null) {
    return `Dernière décision : ${d.last_decision_maps_a}-${d.last_decision_maps_b}`;
  }
  if (d.last_decision_action === "cancel") return "Dernière décision : annulé";
  if (d.last_decision_action === "reset_dispute") {
    return "Dernière décision : litige réinitialisé";
  }
  return null;
}

function DisputeListItem({ d, closed }: { d: AdminDisputeRow; closed?: boolean }) {
  const nameA = labelFromAdminUser(
    {
      email: d.player_a_email,
      roblox_username: d.player_a_roblox_username,
      display_name: d.player_a_display_name,
    },
    d.player_a_label,
  );
  const nameB = labelFromAdminUser(
    {
      email: d.player_b_email,
      roblox_username: d.player_b_roblox_username,
      display_name: d.player_b_display_name,
    },
    d.player_b_label,
  );
  const summary = decisionSummary(d);

  return (
    <li
      data-search={searchBlob(
        d.match_id,
        nameA,
        nameB,
        d.player_a_email,
        d.player_b_email,
        d.status,
        matchStatusLabel(d.status, !closed),
        d.ticket_count,
        d.chat_count,
        d.created_at,
        d.first_ticket_at,
        summary,
      )}
    >
      <Link
        href={`/admin/litiges/${d.match_id}`}
        className={`block rounded-xl border p-4 transition ${
          closed
            ? "border-zinc-600/30 bg-zinc-900/40 hover:border-zinc-500/50 hover:bg-zinc-900/60"
            : "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 hover:bg-amber-500/10"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-zinc-100">
              {nameA} <span className="text-zinc-500">vs</span> {nameB}
            </p>
            <p className="mt-0.5 text-xs text-zinc-600">
              {d.player_a_email} · {d.player_b_email}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Match du {formatDateTimeFr(d.created_at)}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${matchStatusClass(d.status, !closed)}`}
          >
            {closed ? "Litige fermé" : matchStatusLabel(d.status, true)}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          {d.ticket_count} ticket(s) · {d.chat_count} message(s) chat
          {d.first_ticket_at
            ? ` · 1er ticket ${formatDateTimeFr(d.first_ticket_at)}`
            : ""}
        </p>
        {summary ? (
          <p className="mt-1 text-sm text-zinc-500">{summary}</p>
        ) : null}
      </Link>
    </li>
  );
}

export default async function AdminDisputesPage() {
  const [openRows, closedRows] = await Promise.all([
    listAdminDisputesOpen(),
    listAdminDisputesClosed(),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-400/90">
          Litiges en cours
        </h2>
        {openRows.length > 0 ? (
          <TableSearchBar
            targetId="admin-disputes-open-list"
            totalCount={openRows.length}
            placeholder="Rechercher par pseudo, e-mail, date…"
          />
        ) : null}
        {openRows.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-8 text-center text-zinc-500">
            Aucun litige en cours.
          </p>
        ) : (
          <ul id="admin-disputes-open-list" className="space-y-3">
            {openRows.map((d) => (
              <DisputeListItem key={d.match_id} d={d} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Litiges fermés (historique)
        </h2>
        {closedRows.length > 0 ? (
          <TableSearchBar
            targetId="admin-disputes-closed-list"
            totalCount={closedRows.length}
            placeholder="Rechercher dans l’historique…"
          />
        ) : null}
        {closedRows.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-8 text-center text-zinc-500">
            Aucun litige fermé enregistré.
          </p>
        ) : (
          <ul id="admin-disputes-closed-list" className="space-y-3">
            {closedRows.map((d) => (
              <DisputeListItem key={d.match_id} d={d} closed />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
