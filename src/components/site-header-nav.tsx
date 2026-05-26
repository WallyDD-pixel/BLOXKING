"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "@/app/auth/actions";
import { YoutubeChannelLink } from "@/components/youtube-channel-link";
import { YOUTUBE_CHANNEL_URL } from "@/lib/site-links";

type Props = {
  isLoggedIn: boolean;
  display: string | null;
};

const DRAWER_MS = 320;

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-6 w-6 transition-transform duration-200 ease-out"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      {open ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
        />
      )}
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SiteHeaderNav({ isLoggedIn, display }: Props) {
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const navId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuOpen = drawerMounted && drawerVisible;

  const openDrawer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setDrawerMounted(true);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    closeTimer.current = setTimeout(() => {
      setDrawerMounted(false);
      closeTimer.current = null;
    }, DRAWER_MS);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!drawerMounted) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerMounted]);

  useEffect(() => {
    if (!drawerMounted) return;
    const run = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setDrawerVisible(true));
      });
    };
    run();
    return () => setDrawerVisible(false);
  }, [drawerMounted]);

  useEffect(() => {
    if (!drawerMounted || !drawerVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerMounted, drawerVisible]);

  const toggleMobileMenu = () => {
    if (drawerMounted) closeDrawer();
    else openDrawer();
  };

  const linkClass =
    "group/nav flex min-h-[3.25rem] items-center justify-between gap-3 rounded-2xl border border-transparent px-4 text-[0.9375rem] font-medium text-zinc-100 transition-colors duration-200 outline-none hover:border-white/[0.08] hover:bg-white/[0.06] active:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]";

  const linkChevron =
    "size-5 shrink-0 text-zinc-600 transition-transform duration-200 group-hover/nav:translate-x-0.5 group-hover/nav:text-zinc-400";

  const mobileOverlay =
    drawerMounted && typeof document !== "undefined" ? (
      <div
        className="fixed inset-0 z-[200] md:hidden"
        aria-hidden={false}
        data-bk-mobile-nav
      >
        <button
          type="button"
          className={`absolute inset-0 bg-[#030304]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${
            drawerVisible ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Fermer le menu"
          onClick={closeDrawer}
        />

        <div
          id={navId}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={`pointer-events-auto absolute inset-y-0 right-0 flex w-[min(100vw-2rem,21rem)] max-w-full flex-col border-l border-white/[0.12] shadow-[-16px_0_64px_rgba(0,0,0,0.75)] transition-transform duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)] supports-[padding:max(0px)]:pb-[env(safe-area-inset-bottom)] ${
            drawerVisible ? "translate-x-0" : "translate-x-full"
          }`}
          style={{
            background:
              "linear-gradient(165deg, #12121a 0%, #09090b 45%, #08080d 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent"
          />

          <div className="flex h-[3.75rem] shrink-0 items-center justify-between px-5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.28em] text-amber-500/80">
                Navigation
              </span>
              <span className="font-[family-name:var(--font-bebas)] text-xl tracking-[0.12em] text-zinc-100">
                MENU
              </span>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 outline-none transition hover:border-white/20 hover:bg-white/[0.08] hover:text-zinc-50 focus-visible:ring-2 focus-visible:ring-amber-500/50"
              aria-label="Fermer"
              onClick={closeDrawer}
            >
              <MenuIcon open />
            </button>
          </div>

          <nav
            className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent"
            aria-label="Liens du site"
          >
            {isLoggedIn ? (
              <Link
                href="/play"
                className={linkClass}
                onClick={closeDrawer}
              >
                <span>Jouer</span>
                <ChevronRight className={linkChevron} />
              </Link>
            ) : null}
            <Link
              href="/classement"
              className={linkClass}
              onClick={closeDrawer}
            >
              <span>Classement</span>
              <ChevronRight className={linkChevron} />
            </Link>
            {!isLoggedIn ? (
              <Link
                href="/connexion"
                className={linkClass}
                onClick={closeDrawer}
              >
                <span>Connexion</span>
                <ChevronRight className={linkChevron} />
              </Link>
            ) : null}
            <a
              href={YOUTUBE_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClass} text-red-100/95 hover:border-red-500/20 hover:bg-red-950/25`}
              onClick={closeDrawer}
            >
              <span className="flex items-center gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/25">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-[1.125rem] text-red-400"
                    aria-hidden
                  >
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </span>
                YouTube
              </span>
              <ChevronRight className={`${linkChevron} text-red-900/70 group-hover/nav:text-red-300/90`} />
            </a>

            <div className="relative my-2 py-1">
              <div className="absolute inset-x-2 top-1/2 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
            </div>

            {isLoggedIn ? (
              <form action={signOut} className="mt-auto pt-1">
                <button
                  type="submit"
                  className="flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.03] px-4 text-[0.9375rem] font-medium text-zinc-200 outline-none transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-amber-500/45"
                >
                  Déconnexion
                </button>
              </form>
            ) : (
              <Link
                href="/inscription"
                className="mt-auto flex min-h-[3.25rem] items-center justify-center rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 px-4 text-[0.9375rem] font-bold tracking-wide text-zinc-950 shadow-lg shadow-black/35 ring-1 ring-amber-400/35 transition hover:from-amber-300 hover:to-amber-500"
                onClick={closeDrawer}
              >
                S&apos;inscrire
              </Link>
            )}
          </nav>
        </div>
      </div>
    ) : null;

  return (
    <>
      <nav
        className="hidden items-center gap-1 md:flex md:flex-wrap md:justify-end md:gap-2"
        aria-label="Navigation principale"
      >
        {isLoggedIn ? (
          <Link
            href="/play"
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
          >
            Jouer
          </Link>
        ) : null}
        <Link
          href="/classement"
          className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
        >
          Classement
        </Link>
        {!isLoggedIn ? (
          <Link
            href="/connexion"
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
          >
            Connexion
          </Link>
        ) : null}
        <YoutubeChannelLink variant="header" />
        {isLoggedIn ? (
          <>
            <span
              className="hidden max-w-[140px] truncate px-2 text-sm text-zinc-300 lg:inline"
              title={display ?? undefined}
            >
              {display}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
              >
                Déconnexion
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/inscription"
            className="ml-1 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-900/30 transition hover:from-amber-300 hover:to-amber-500"
          >
            S&apos;inscrire
          </Link>
        )}
      </nav>

      <div className="flex items-center gap-2 md:hidden">
        {isLoggedIn && display ? (
          <span
            className="max-w-[6.5rem] truncate rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1.5 text-[0.7rem] font-medium tracking-wide text-zinc-300"
            title={display}
          >
            {display}
          </span>
        ) : null}
        <button
          type="button"
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border text-zinc-100 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050506] ${
            drawerMounted && drawerVisible
              ? "border-amber-500/40 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
              : "border-white/12 bg-white/[0.06] hover:bg-white/10 hover:border-white/18"
          }`}
          aria-expanded={menuOpen}
          aria-controls={navId}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={toggleMobileMenu}
        >
          <MenuIcon open={menuOpen} />
        </button>
      </div>

      {mobileOverlay ? createPortal(mobileOverlay, document.body) : null}
    </>
  );
}
