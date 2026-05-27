import Link from "next/link";
import { TableSearchBar } from "@/components/table-search-bar";
import { listAdminUsers } from "@/lib/admin/queries";
import { searchBlob } from "@/lib/table-search";

export default async function AdminUsersPage() {
  const rows = await listAdminUsers(150);

  return (
    <div className="space-y-4">
      <TableSearchBar
        targetId="admin-users-table"
        totalCount={rows.length}
        placeholder="Rechercher par pseudo, e-mail, ELO…"
      />
      <div
        id="admin-users-table"
        className="overflow-x-auto rounded-xl border border-white/10"
      >
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-white/10 bg-zinc-900/80 text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">Joueur</th>
            <th className="px-4 py-3 font-medium">ELO</th>
            <th className="px-4 py-3 font-medium">Matchs</th>
            <th className="px-4 py-3 font-medium">Inscription</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((u) => (
            <tr
              key={u.id}
              className="hover:bg-white/[0.02]"
              data-search={searchBlob(
                u.id,
                u.email,
                u.roblox_username,
                u.display_name,
                u.elo,
                u.placement_matches_played,
                u.matches_total,
                u.matches_wins,
                u.is_admin ? "admin" : "",
              )}
            >
              <td className="px-4 py-3">
                <p className="font-medium text-zinc-100">
                  {u.roblox_username ?? u.display_name ?? "—"}
                  {u.is_admin ? (
                    <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-amber-300">
                      admin
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-zinc-500">{u.email}</p>
              </td>
              <td className="px-4 py-3 font-mono text-zinc-300">
                {u.elo ?? "—"}
                {u.placement_matches_played != null &&
                u.placement_matches_played < 5 ? (
                  <span className="ml-1 text-xs text-zinc-600">
                    (place. {u.placement_matches_played}/5)
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-zinc-300">
                {u.matches_total} · {u.matches_wins} V
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                {new Date(u.created_at).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/joueur/${u.id}`}
                  className="text-amber-400 hover:text-amber-300"
                >
                  Profil
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
