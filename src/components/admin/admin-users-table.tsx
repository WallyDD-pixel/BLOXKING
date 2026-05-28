"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { adminSearchUsers } from "@/app/admin/actions";
import { AdminUserRoleToggle } from "@/components/admin/admin-user-role-toggle";
import type { AdminUserRow } from "@/lib/admin/queries";
import { labelFromAdminUser } from "@/lib/admin/user-label";
import { formatDateFr } from "@/lib/format-datetime";

type Props = {
  initialRows: AdminUserRow[];
  totalUsers: number;
  defaultListLimit: number;
};

function UserRows({ rows }: { rows: AdminUserRow[] }) {
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
          Aucun joueur trouvé.
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((u) => {
        const label = labelFromAdminUser({
          email: u.email,
          roblox_username: u.roblox_username,
          display_name: u.display_name,
        });
        return (
          <tr key={u.id} className="hover:bg-white/[0.02]">
            <td className="px-4 py-3">
              <p className="font-medium text-zinc-100">
                {label}
                {u.is_admin ? (
                  <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-amber-300">
                    admin
                  </span>
                ) : null}
                {u.is_dispute_moderator && !u.is_admin ? (
                  <span className="ml-2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-sky-300">
                    mod. litiges
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
              {formatDateFr(u.created_at)}
            </td>
            <td className="px-4 py-3">
              {!u.is_admin ? (
                <AdminUserRoleToggle
                  userId={u.id}
                  userLabel={label}
                  isDisputeModerator={u.is_dispute_moderator}
                />
              ) : (
                <span className="text-xs text-zinc-600">Admin complet</span>
              )}
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
        );
      })}
    </>
  );
}

export function AdminUsersTable({
  initialRows,
  totalUsers,
  defaultListLimit,
}: Props) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(initialRows);
  const [mode, setMode] = useState<"recent" | "search">("recent");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setRows(initialRows);
      setMode("recent");
      setError(null);
      return;
    }

    startTransition(async () => {
      setError(null);
      const res = await adminSearchUsers(trimmed);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRows(res.rows ?? []);
      setMode("search");
    });
  }, [initialRows]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setRows(initialRows);
      setMode("recent");
      setError(null);
      return;
    }

    const t = setTimeout(() => runSearch(trimmed), 280);
    return () => clearTimeout(t);
  }, [query, initialRows, runSearch]);

  const statusLine =
    mode === "recent" ? (
      <>
        {initialRows.length} derniers inscrits affichés ·{" "}
        <span className="text-zinc-400">{totalUsers}</span> comptes au total
      </>
    ) : pending ? (
      <>Recherche en cours…</>
    ) : (
      <>
        <span className="text-zinc-300">{rows.length}</span> résultat
        {rows.length !== 1 ? "s" : ""} · {totalUsers} comptes au total
      </>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">Rechercher un joueur</span>
          <svg
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans tous les comptes (e-mail, pseudo, Roblox, id)…"
            className="w-full rounded-xl border border-white/12 bg-zinc-950/80 py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
              aria-label="Effacer la recherche"
            >
              ×
            </button>
          ) : null}
        </label>
        <p className="shrink-0 font-mono text-xs text-zinc-500">{statusLine}</p>
      </div>

      {mode === "recent" && !query.trim() ? (
        <p className="text-xs text-zinc-600">
          La liste ci-dessous montre les {defaultListLimit} derniers inscrits.
          Tape un e-mail ou un pseudo pour chercher parmi les{" "}
          {totalUsers.toLocaleString("fr-FR")} comptes.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/10 bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Joueur</th>
              <th className="px-4 py-3 font-medium">ELO</th>
              <th className="px-4 py-3 font-medium">Matchs</th>
              <th className="px-4 py-3 font-medium">Inscription</th>
              <th className="px-4 py-3 font-medium">Rôles</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <UserRows rows={rows} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
