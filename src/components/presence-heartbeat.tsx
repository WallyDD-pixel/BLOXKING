"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { PRESENCE_HEARTBEAT_INTERVAL_MS } from "@/lib/presence/constants";

export function PresenceHeartbeat() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unauthorized = false;

    async function ping(path: string) {
      if (cancelled) return;
      if (unauthorized) return;
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/presence/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
          keepalive: true,
        });
        if (res.status === 401) unauthorized = true;
      } catch {
        /* réseau / hors ligne */
      }
    }

    const path = pathname || "/";
    lastPath.current = path;
    void ping(path);

    const onVisible = () => {
      if (document.visibilityState === "visible" && lastPath.current) {
        void ping(lastPath.current);
      }
    };

    const interval = window.setInterval(() => {
      if (lastPath.current) void ping(lastPath.current);
    }, PRESENCE_HEARTBEAT_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return null;
}
