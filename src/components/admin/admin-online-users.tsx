"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTimeFr } from "@/lib/format-datetime";

type OnlineUser = {
  id: string;
  email: string;
  display_name: string | null;
  roblox_username: string | null;
  last_seen_at: string;
  last_seen_path: string | null;
};

type Payload = {
  count: number;
  windowMinutes: number;
  users: OnlineUser[];
};

const POLL_MS = 30_000;

function label(u: OnlineUser): string {
  return u.roblox_username ?? u.display_name ?? u.email;
}

export function AdminOnlineUsers({
  initialCount,
  initialWindowMinutes,
}: {
  initialCount: number;
  initialWindowMinutes: number;
}) {
  const [data, setData] = useState<Payload>({
    count: initialCount,
    windowMinutes: initialWindowMinutes,
    users: [],
  });
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/online-users", { cache: "no-store" });
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "Impossible de charger la présence");
        return;
      }
      setErr(null);
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  return (
    <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-emerald-100">
            Utilisateurs en ligne
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Comptes connectés ayant interagi avec le site dans les{" "}
            <strong className="text-zinc-400">{data.windowMinutes} dernières minutes</strong>{" "}
            (rafraîchi toutes les 30 s).
          </p>
        </div>
        <p className="font-[family-name:var(--font-bebas)] text-5xl tabular-nums text-emerald-300">
          {data.count}
        </p>
      </div>

      {err ? (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      {data.users.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          Personne en ligne pour l&apos;instant (ou migration{" "}
          <code className="text-zinc-400">db/09_user_presence.sql</code> non
          appliquée).
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-white/10 bg-zinc-900/80 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Joueur</th>
                <th className="px-4 py-3 font-medium">Dernière page</th>
                <th className="px-4 py-3 font-medium">Vu à</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="text-zinc-200">{label(u)}</p>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {u.last_seen_path ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                    {formatDateTimeFr(u.last_seen_at, {
                      timeStyle: "medium",
                      dateStyle: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
