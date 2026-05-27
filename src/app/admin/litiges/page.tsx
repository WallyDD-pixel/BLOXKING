import Link from "next/link";
import { listAdminDisputes } from "@/lib/admin/queries";
import { matchStatusClass, matchStatusLabel } from "@/lib/admin/display";

export default async function AdminDisputesPage() {
  const rows = await listAdminDisputes();

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-8 text-center text-zinc-500">
          Aucun litige en cours.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => (
            <li key={d.match_id}>
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
