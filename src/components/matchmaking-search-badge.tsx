"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getQueueMatchSince,
  joinQueue,
  leaveQueue,
  touchQueue,
} from "@/app/play/actions";
import {
  clearMatchmakingSearch,
  dispatchMatchmakingSearchChanged,
  formatSearchDurationFr,
  matchmakingSearchEventName,
  readMatchmakingSearch,
} from "@/lib/matchmaking-search-storage";

type Props = {
  userId: string;
};

export function MatchmakingSearchBadge({ userId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const [foundMatchId, setFoundMatchId] = useState<string | null>(null);
  const [redirectSec, setRedirectSec] = useState(4);
  const handledFoundRef = useRef(false);
  const pollTickRef = useRef(0);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const ev = matchmakingSearchEventName();
    window.addEventListener(ev, refresh);
    return () => window.removeEventListener(ev, refresh);
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(refresh, 1000);
    return () => window.clearInterval(id);
  }, [refresh]);

  void tick;

  const onRecherche =
    pathname === "/play/recherche" || pathname.startsWith("/play/recherche/");
  const onMatchRoom = pathname.startsWith("/play/match/");

  const p = mounted ? readMatchmakingSearch() : null;
  const searchingElsewhere =
    p != null &&
    p.userId === userId &&
    !onRecherche &&
    !onMatchRoom &&
    foundMatchId == null;

  const shouldShowFoundBanner =
    foundMatchId != null &&
    pathname !== `/play/match/${foundMatchId}`;

  useEffect(() => {
    if (!foundMatchId || handledFoundRef.current) return;
    handledFoundRef.current = true;
    clearMatchmakingSearch(userId);
    dispatchMatchmakingSearchChanged();
    void leaveQueue();
  }, [foundMatchId, userId]);

  useEffect(() => {
    if (!shouldShowFoundBanner || !foundMatchId) return;
    setRedirectSec(4);
    const interval = window.setInterval(() => {
      setRedirectSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    const go = window.setTimeout(() => {
      router.push(`/play/match/${foundMatchId}`);
    }, 4000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(go);
    };
  }, [shouldShowFoundBanner, foundMatchId, router]);

  useEffect(() => {
    if (!searchingElsewhere) return;

    const run = async () => {
      const cur = readMatchmakingSearch();
      if (!cur || cur.userId !== userId) return;

      const searchSinceIso = new Date(
        Date.parse(cur.since) - 15_000,
      ).toISOString();

      pollTickRef.current += 1;
      const heavyTick = pollTickRef.current % 2 === 1;

      const { match } = await getQueueMatchSince(searchSinceIso);
      if (match?.id) {
        setFoundMatchId(match.id);
        return;
      }

      if (!heavyTick) {
        await touchQueue();
        return;
      }

      const res = await joinQueue();
      if (!("error" in res && res.error)) {
        if (
          "matched" in res &&
          res.matched === true &&
          "matchId" in res &&
          typeof res.matchId === "string"
        ) {
          setFoundMatchId(res.matchId);
        }
      }
    };

    void run();
    const id = window.setInterval(() => void run(), 3000);
    return () => window.clearInterval(id);
  }, [searchingElsewhere, userId]);

  useEffect(() => {
    if (
      foundMatchId &&
      pathname === `/play/match/${foundMatchId}`
    ) {
      setFoundMatchId(null);
      handledFoundRef.current = false;
    }
  }, [pathname, foundMatchId]);

  if (!mounted) return null;

  if (shouldShowFoundBanner && foundMatchId) {
    return (
      <div className="mb-4 flex justify-center sm:justify-end">
        <div className="inline-flex max-w-full flex-col gap-2 rounded-xl border border-emerald-500/45 bg-emerald-500/[0.12] px-4 py-3 shadow-[0_0_28px_rgba(52,211,153,0.12)] sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
            </span>
            <div className="min-w-0 text-left">
              <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-emerald-200/95 sm:text-[0.6rem]">
                Match trouvé
              </p>
              <p className="mt-0.5 font-mono text-[0.65rem] text-zinc-400 sm:text-xs">
                {redirectSec > 0
                  ? `Ouverture de la salle dans ${redirectSec} s…`
                  : "Redirection…"}
              </p>
            </div>
          </div>
          <Link
            href={`/play/match/${foundMatchId}`}
            className="game-btn-primary inline-flex shrink-0 items-center justify-center px-4 py-2.5 text-center font-[family-name:var(--font-bebas)] text-lg tracking-wide text-zinc-950 sm:min-w-[10rem]"
          >
            Ouvrir la rencontre
          </Link>
        </div>
      </div>
    );
  }

  if (
    !p ||
    p.userId !== userId ||
    onRecherche ||
    onMatchRoom ||
    foundMatchId != null
  ) {
    return null;
  }

  const elapsed = Date.now() - Date.parse(p.since);
  const label = formatSearchDurationFr(elapsed);

  return (
    <div className="mb-4 flex justify-center sm:justify-end">
      <Link
        href="/play/recherche"
        className="group inline-flex max-w-full items-center gap-2.5 rounded-full border border-amber-500/40 bg-amber-500/[0.12] px-3 py-2 shadow-[0_0_24px_rgba(245,158,11,0.08)] transition hover:border-amber-400/55 hover:bg-amber-500/[0.18] sm:px-4"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
        </span>
        <span className="min-w-0 text-left">
          <span className="block font-mono text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-amber-200/95 sm:text-[0.6rem]">
            Recherche en cours
          </span>
          <span className="mt-0.5 block font-mono text-[0.65rem] tabular-nums text-zinc-400 sm:text-xs">
            Depuis {label}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[0.55rem] uppercase tracking-wider text-amber-500/90 group-hover:text-amber-300">
          →
        </span>
      </Link>
    </div>
  );
}
