"use client";

import Link from "next/link";
import { useState } from "react";

type Row = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

type Props = {
  initialRows: Row[];
};

function formatFr(value: string) {
  return new Date(value).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
}

export function NotificationsList({ initialRows }: Props) {
  const [rows, setRows] = useState(initialRows);
  const unread = rows.filter((r) => !r.read_at).length;

  const markAllRead = async () => {
    const res = await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) return;
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        read_at: r.read_at ?? new Date().toISOString(),
      })),
    );
  };

  const markOneRead = async (id: string) => {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, read_at: r.read_at ?? new Date().toISOString() } : r)),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          {unread > 0 ? `${unread} non lue(s)` : "Tout est lu"}
        </p>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unread === 0}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Tout marquer comme lu
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 px-5 py-10 text-center text-sm text-zinc-500">
          Aucune notification pour l’instant.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border px-4 py-3 ${
                n.read_at
                  ? "border-white/10 bg-white/[0.02]"
                  : "border-amber-500/30 bg-amber-500/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-100">{n.title}</p>
                  <p className="mt-1 text-sm text-zinc-300">{n.body}</p>
                  <p className="mt-2 text-xs text-zinc-500">{formatFr(n.created_at)}</p>
                </div>
                {!n.read_at ? (
                  <button
                    type="button"
                    onClick={() => markOneRead(n.id)}
                    className="shrink-0 rounded border border-amber-400/30 px-2 py-1 text-xs text-amber-300 transition hover:bg-amber-500/10"
                  >
                    Lu
                  </button>
                ) : null}
              </div>
              {n.href ? (
                <Link
                  href={n.href}
                  className="mt-3 inline-block text-sm text-amber-300 underline-offset-2 hover:underline"
                >
                  Ouvrir
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
