"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bk_live_popin_dismissed_until";
const DISMISS_HOURS = 6;

function nowMs() {
  return Date.now();
}

function canShow(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const until = raw ? Number(raw) : 0;
    return !(until && until > nowMs());
  } catch {
    return true;
  }
}

function dismiss() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      String(nowMs() + DISMISS_HOURS * 60 * 60 * 1000),
    );
  } catch {
    // ignore
  }
}

export function YoutubeLivePopin({
  title,
  watchUrl,
}: {
  title: string;
  watchUrl: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (canShow()) setOpen(true);
  }, []);

  const safeTitle = useMemo(() => title || "Live YouTube", [title]);

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)]">
      <div className="relative overflow-hidden rounded-2xl border border-red-500/35 bg-gradient-to-b from-zinc-950/95 to-red-950/35 p-4 shadow-[0_0_40px_rgba(239,68,68,0.18)]">
        <div className="pointer-events-none absolute -right-12 -top-10 h-28 w-28 rounded-full bg-red-500/20 blur-3xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.32em] text-red-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              Live maintenant
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-100 line-clamp-2">
              {safeTitle}
            </p>
          </div>

          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            onClick={() => {
              dismiss();
              setOpen(false);
            }}
            aria-label="Fermer"
          >
            Fermer
          </button>
        </div>

        <div className="relative mt-4 flex items-center gap-2">
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-red-500 px-4 text-sm font-bold text-zinc-950 transition hover:bg-red-400"
          >
            Rejoindre le live
          </a>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

