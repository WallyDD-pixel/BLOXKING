"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  className?: string;
};

export function NotificationsBell({ className }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (alive) setCount(Number(data.count ?? 0));
      } catch {
        /* ignore polling errors */
      }
    };

    void load();
    const id = setInterval(() => void load(), 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className={`relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-zinc-100 ${className ?? ""}`}
      aria-label={count > 0 ? `Notifications (${count} non lues)` : "Notifications"}
      title={count > 0 ? `${count} notifications non lues` : "Notifications"}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 0 1 5.454 1.31A8.967 8.967 0 0 1 12 21a8.967 8.967 0 0 1-8.312-2.608 23.848 23.848 0 0 1 5.454-1.31M6.75 8.25a5.25 5.25 0 1 1 10.5 0c0 2.66.736 4.512 1.293 5.72a.75.75 0 0 1-.68 1.03H6.887a.75.75 0 0 1-.68-1.03c.557-1.208 1.293-3.06 1.293-5.72Z"
        />
      </svg>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[0.62rem] font-semibold leading-none text-zinc-950">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
