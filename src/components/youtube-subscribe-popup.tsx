"use client";

import { useEffect, useState } from "react";
import { YOUTUBE_CHANNEL_LABEL, YOUTUBE_CHANNEL_URL } from "@/lib/site-links";

const STORAGE_KEY = "bk_yt_subscribe_popup_dismissed_until";
const DISMISS_HOURS_LATER = 24;
const DISMISS_DAYS_SUBSCRIBED = 30;

/** Lien avec invite d’abonnement YouTube (paramètre officiel). */
const YOUTUBE_SUBSCRIBE_URL = `${YOUTUBE_CHANNEL_URL}?sub_confirmation=1`;

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

function dismissForMs(ms: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(nowMs() + ms));
  } catch {
    // ignore
  }
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function YoutubeSubscribePopup() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!canShow()) return;
    setOpen(true);
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLater();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const closeLater = () => {
    dismissForMs(DISMISS_HOURS_LATER * 60 * 60 * 1000);
    setVisible(false);
    setTimeout(() => setOpen(false), 280);
  };

  const closeAfterSubscribe = () => {
    dismissForMs(DISMISS_DAYS_SUBSCRIBED * 24 * 60 * 60 * 1000);
    setVisible(false);
    setTimeout(() => setOpen(false), 280);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-[#030304]/85 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Fermer"
        onClick={closeLater}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="yt-subscribe-title"
        className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-b from-zinc-900 via-zinc-950 to-[#0c0a0a] shadow-[0_0_60px_rgba(239,68,68,0.2)] transition-all duration-300 ease-out ${
          visible
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-3"
        }`}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl"
          aria-hidden
        />

        <button
          type="button"
          className="absolute right-3 top-3 z-10 inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-zinc-50"
          onClick={closeLater}
          aria-label="Fermer"
        >
          ×
        </button>

        <div className="relative px-6 pb-6 pt-8 text-center sm:px-8 sm:pb-8 sm:pt-9">
          <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-red-500/15 ring-1 ring-red-500/35">
            <YoutubeIcon className="size-8 text-red-400" />
          </div>

          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-amber-400/90">
            BloXKING × Warren
          </p>
          <h2
            id="yt-subscribe-title"
            className="mt-3 font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-zinc-50 sm:text-4xl"
          >
            Abonne-toi sur YouTube
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
            Lives, défis et actus du ladder — ne rate pas les annonces de matchs
            et la finale{" "}
            <span className="text-amber-200/90">10 000 Robux</span>.
          </p>

          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <a
              href={YOUTUBE_SUBSCRIBE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red-500 px-6 text-sm font-bold text-zinc-950 shadow-lg shadow-red-900/40 transition hover:bg-red-400"
              onClick={closeAfterSubscribe}
            >
              <YoutubeIcon className="size-5" />
              S&apos;abonner à la chaîne
            </a>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 text-sm font-semibold text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.08]"
              onClick={closeLater}
            >
              Plus tard
            </button>
          </div>

          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-xs text-zinc-500 underline-offset-2 hover:text-red-300/90 hover:underline"
            onClick={closeAfterSubscribe}
          >
            {YOUTUBE_CHANNEL_LABEL}
          </a>
        </div>
      </div>
    </div>
  );
}
