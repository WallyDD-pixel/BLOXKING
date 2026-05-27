"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { SESSION_SYNC_INTERVAL_MS } from "@/lib/polling/constants";
import {
  dispatchSessionSync,
  type SessionSyncDetail,
  type SessionSyncNotification,
} from "@/lib/session-sync-event";

export function SessionSync() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const seenNotifs = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let unauthorized = false;

    async function sync(path: string) {
      if (cancelled || unauthorized) return;
      if (document.visibilityState === "hidden") return;

      try {
        const res = await fetch("/api/session/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
          keepalive: true,
        });
        if (res.status === 401) {
          unauthorized = true;
          return;
        }
        if (!res.ok) return;

        const data = (await res.json()) as SessionSyncDetail;
        dispatchSessionSync(data);
        showBrowserNotifications(data.notifications ?? []);
      } catch {
        /* réseau / hors ligne */
      }
    }

    function showBrowserNotifications(items: SessionSyncNotification[]) {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      for (const item of items) {
        if (item.read_at !== null || seenNotifs.current.has(item.id)) continue;
        seenNotifs.current.add(item.id);
        const notif = new Notification(item.title, {
          body: item.body,
          tag: `bk-${item.id}`,
        });
        notif.onclick = () => {
          if (item.href) window.location.href = item.href;
          window.focus();
        };
      }
    }

    const path = pathname || "/";
    lastPath.current = path;
    void sync(path);

    const onVisible = () => {
      if (document.visibilityState === "visible" && lastPath.current) {
        void sync(lastPath.current);
      }
    };

    const interval = window.setInterval(() => {
      if (lastPath.current) void sync(lastPath.current);
    }, SESSION_SYNC_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  return null;
}
