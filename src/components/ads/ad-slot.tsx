"use client";

import { useEffect, useRef, useState } from "react";
import {
  adsenseClientId,
  adsenseSlotId,
  isAdPlacementConfigured,
  showAdPlaceholders,
  type AdPlacement,
} from "@/lib/ads/config";

type AdSlotProps = {
  placement: AdPlacement;
  className?: string;
  wrapperClassName?: string;
};

type AdState = "loading" | "shown" | "failed";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const LOAD_POLL_MS = 400;
const LOAD_TIMEOUT_MS = 3500;

function adHasRendered(ins: HTMLElement): boolean {
  if (ins.querySelector("iframe")) return true;
  return ins.offsetHeight > 24 && ins.offsetWidth > 24;
}

export function AdSlot({
  placement,
  className = "",
  wrapperClassName = "",
}: AdSlotProps) {
  const clientId = adsenseClientId();
  const slotId = adsenseSlotId(placement);
  const isSidebar =
    placement === "sidebar-left" || placement === "sidebar-right";
  const mountRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<AdState>("loading");

  const configured = isAdPlacementConfigured(placement);
  const placeholders = showAdPlaceholders();

  useEffect(() => {
    if (!configured || !clientId || !slotId) {
      setState("failed");
      return;
    }

    setState("loading");

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      setState("failed");
      return;
    }

    let cancelled = false;
    const started = Date.now();

    const tick = () => {
      if (cancelled) return;
      const ins = mountRef.current?.querySelector(
        "ins.adsbygoogle",
      ) as HTMLElement | null;
      if (ins && adHasRendered(ins)) {
        setState("shown");
        return;
      }
      if (Date.now() - started >= LOAD_TIMEOUT_MS) {
        setState("failed");
        return;
      }
      window.setTimeout(tick, LOAD_POLL_MS);
    };

    window.setTimeout(tick, LOAD_POLL_MS);

    return () => {
      cancelled = true;
    };
  }, [configured, clientId, slotId]);

  if (!configured && !placeholders) return null;

  if (placeholders && !configured) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-6 text-center ${className}`}
        aria-hidden
      >
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-zinc-500">
          Espace pub (debug)
        </p>
      </div>
    );
  }

  if (state === "failed") return null;

  const ins = (
    <ins
      className={`adsbygoogle block ${state === "shown" ? className : ""}`}
      style={{ display: "block" }}
      data-ad-client={clientId!}
      data-ad-slot={slotId!}
      data-ad-format={isSidebar ? "vertical" : "auto"}
      data-full-width-responsive={isSidebar ? undefined : "true"}
    />
  );

  const mount = (
    <div
      ref={mountRef}
      className={
        state === "shown"
          ? wrapperClassName
          : "pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
      }
      aria-hidden={state !== "shown"}
    >
      {ins}
    </div>
  );

  if (isSidebar && state === "shown") {
    return (
      <aside
        className="hidden w-[160px] shrink-0 xl:block"
        aria-label={
          placement === "sidebar-left" ? "Publicité gauche" : "Publicité droite"
        }
      >
        <div className="sticky top-24">{mount}</div>
      </aside>
    );
  }

  if (isSidebar) {
    return mount;
  }

  return mount;
}
