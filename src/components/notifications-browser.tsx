"use client";

import { useEffect, useRef } from "react";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
};

export function NotificationsBrowser() {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    let alive = true;
    let unauthorized = false;
    const load = async () => {
      if (unauthorized) return;
      try {
        const res = await fetch("/api/notifications?limit=15", { cache: "no-store" });
        if (res.status === 401) {
          unauthorized = true;
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { notifications?: NotificationItem[] };
        if (!alive) return;

        for (const item of data.notifications ?? []) {
          if (item.read_at !== null || seen.current.has(item.id)) continue;
          seen.current.add(item.id);
          if (Notification.permission !== "granted") continue;
          const notif = new Notification(item.title, {
            body: item.body,
            tag: `bk-${item.id}`,
          });
          notif.onclick = () => {
            if (item.href) window.location.href = item.href;
            window.focus();
          };
        }
      } catch {
        /* ignore */
      }
    };

    void load();
    const id = setInterval(() => void load(), 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  return null;
}
