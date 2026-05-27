"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMatchById,
  getQueueMatchSince,
  joinQueue,
  leaveQueue,
  listOngoingMatches,
  type OngoingMatchRow,
} from "@/app/play/actions";
import { OngoingMatchesBlock } from "@/components/ongoing-matches-block";
import { PvpRecordingTip } from "@/components/pvp-recording-tip";
import {
  clearMatchmakingSearch,
  readMatchmakingSearch,
  setMatchmakingSearchActive,
} from "@/lib/matchmaking-search-storage";
import {
  MATCHMAKING_POLL_MS,
  ONGOING_MATCHES_POLL_MS,
} from "@/lib/polling/constants";

type Phase = "idle" | "searching" | "matched";

/** 0 = adversaire trouvé, 1 = création de la rencontre (puis redirection). */
type MatchIntroStep = 0 | 1;

type MatchRow = {
  id: string;
  player_a: string;
  player_b: string;
  player_a_label: string | null;
  player_b_label: string | null;
};

/** Cartes : pleine largeur en grille mobile (2 col.) · taille fixe à partir de lg. */
const MM_CARD_SHELL =
  "box-border flex w-full min-w-0 flex-col overflow-hidden rounded-xl max-lg:h-[258px] lg:h-[350px] lg:w-[270px] lg:max-w-[270px] lg:shrink-0";

/** Lignes du ruban : uniquement libellés anonymes (pas de pseudos réels avant match). */
const ANON_DECK_SUBS = [
  "Profil masqué",
  "En attente",
  "···",
  "Recherche active",
  "Identité cachée",
  "···",
  "Scan neutre",
  "Masqué",
];

function DeckStrip({ sub }: { sub: string }) {
  return (
    <div className="flex h-[132px] min-h-[132px] shrink-0 flex-col items-center justify-center border-b border-amber-500/10 px-2 py-2 lg:h-[196px] lg:min-h-[196px] lg:px-3 lg:py-3">
      <div className="relative shrink-0">
        <div className="absolute -inset-0.5 rounded-lg bg-amber-500/12 blur-md lg:-inset-1 lg:rounded-xl" />
        <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-amber-500/35 bg-zinc-950 font-[family-name:var(--font-bebas)] text-base tracking-wider text-amber-200/75 lg:h-16 lg:w-16 lg:rounded-xl lg:text-xl">
          ??
        </div>
      </div>
      <p className="mt-1.5 max-w-full px-0.5 text-center font-[family-name:var(--font-bebas)] text-base tracking-wide text-zinc-100 lg:mt-3 lg:text-xl">
        Anonyme
      </p>
      <p className="mt-1 max-w-full truncate px-0.5 text-center font-mono text-[0.55rem] uppercase leading-tight tracking-wider text-zinc-500 lg:mt-1.5 lg:text-[0.65rem]">
        {sub}
      </p>
    </div>
  );
}

/** Fenêtre fixe + ruban anonyme (noms révélés seulement après match). */
function OpponentProbeCard() {
  const loop = [...ANON_DECK_SUBS, ...ANON_DECK_SUBS];

  return (
    <div
      className={`${MM_CARD_SHELL} border border-amber-500/25 bg-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
    >
      <div className="shrink-0 border-b border-amber-500/10 px-2 py-1.5 text-center lg:px-3 lg:py-2.5">
        <p className="font-mono text-[0.45rem] uppercase tracking-[0.28em] text-amber-500/90 lg:text-[0.5rem] lg:tracking-[0.3em]">
          Signaux
        </p>
        <p className="mt-0.5 font-mono text-[0.5rem] leading-tight text-zinc-500 lg:text-[0.55rem]">
          Attente adversaire
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-2 lg:px-3 lg:pb-3 lg:pt-3">
        <div className="relative h-[132px] overflow-hidden rounded-lg border border-amber-500/15 bg-zinc-950/80 lg:h-[196px] lg:rounded-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-6 bg-gradient-to-b from-black from-35% to-transparent lg:h-8" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-6 bg-gradient-to-t from-black from-35% to-transparent lg:h-8" />
          <div aria-hidden className="mm-scan-beam-card" />
          <div className="mm-opponent-deck relative z-[1] flex flex-col">
            {loop.map((sub, i) => (
              <DeckStrip key={`${sub}-${i}`} sub={sub} />
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-center font-mono text-[0.45rem] leading-snug text-zinc-600 lg:mt-2.5 lg:text-[0.5rem]">
          Identités masquées jusqu&apos;au match
        </p>
      </div>
    </div>
  );
}

function PlayerQueueCard({
  displayName,
  userId,
}: {
  displayName: string;
  userId: string;
}) {
  const initial = displayName.slice(0, 2).toUpperCase();
  return (
    <div
      className={`${MM_CARD_SHELL} border border-amber-400/35 bg-gradient-to-b from-amber-500/12 via-zinc-950 to-zinc-950 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] lg:p-4`}
    >
      <p className="font-mono text-[0.45rem] uppercase tracking-[0.28em] text-amber-500/85 lg:text-[0.5rem] lg:tracking-[0.3em]">
        Ton profil
      </p>
      <div className="mt-2 flex min-h-0 flex-1 flex-col items-center justify-center text-center lg:mt-3">
        <div className="relative shrink-0">
          <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-br from-amber-500/35 to-amber-800/15 opacity-90 blur-sm" />
          <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border-2 border-amber-400/45 bg-zinc-950 font-[family-name:var(--font-bebas)] text-base tracking-wider text-amber-100 lg:h-14 lg:w-14 lg:text-lg">
            {initial}
          </div>
        </div>
        <p className="mt-2 max-w-full truncate px-0.5 font-[family-name:var(--font-bebas)] text-base leading-tight tracking-wide text-white lg:mt-3 lg:text-xl">
          {displayName}
        </p>
        <p className="mt-1 font-mono text-[0.5rem] text-zinc-600 lg:mt-1.5 lg:text-[0.55rem]">
          ID {userId.slice(0, 8)}…
        </p>
      </div>
      <div className="mt-auto shrink-0 rounded-md border border-amber-500/20 bg-amber-500/5 px-1.5 py-1 lg:px-2 lg:py-1.5">
        <p className="text-center font-mono text-[0.55rem] uppercase leading-tight tracking-wider text-amber-400/95 lg:text-[0.6rem]">
          Statut · En recherche
        </p>
      </div>
    </div>
  );
}

export function MatchmakingClient({
  userId,
  displayName,
  initialOngoingMatches,
  placementMatchesPlayed,
}: {
  userId: string;
  displayName: string;
  initialOngoingMatches: OngoingMatchRow[];
  placementMatchesPlayed: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [opponentLabel, setOpponentLabel] = useState<string | null>(null);
  const [serviceFallback, setServiceFallback] = useState(false);
  const [matchIntroStep, setMatchIntroStep] = useState<MatchIntroStep>(0);
  const [blockNewScan, setBlockNewScan] = useState(
    initialOngoingMatches.length > 0,
  );
  const searchSince = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFnRef = useRef<() => Promise<void>>(async () => {});

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resolveOpponent = useCallback(
    (m: MatchRow) => {
      const isA = m.player_a === userId;
      const raw = isA ? m.player_b_label : m.player_a_label;
      setOpponentLabel(raw ?? "Adversaire");
    },
    [userId],
  );

  const poll = useCallback(async () => {
    const applyFound = (row: MatchRow) => {
      clearMatchmakingSearch(userId);
      setMatch(row);
      resolveOpponent(row);
      setPhase("matched");
      stopPolling();
      void leaveQueue();
    };

    const res = await joinQueue();
    if ("error" in res && res.error) {
      if (searchSince.current) {
        const { match: found } = await getQueueMatchSince(searchSince.current);
        if (found) applyFound(found as MatchRow);
      }
      return;
    }

    if (
      "matched" in res &&
      res.matched === true &&
      "matchId" in res &&
      typeof res.matchId === "string"
    ) {
      const { match: row } = await getMatchById(res.matchId);
      if (row) {
        applyFound(row as MatchRow);
        return;
      }
    }

    if (searchSince.current) {
      const { match: found } = await getQueueMatchSince(searchSince.current);
      if (found) applyFound(found as MatchRow);
    }
  }, [resolveOpponent, stopPolling, userId]);

  useEffect(() => {
    pollFnRef.current = poll;
  }, [poll]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    setBlockNewScan(initialOngoingMatches.length > 0);
  }, [initialOngoingMatches]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void listOngoingMatches().then(({ rows }) => {
        setBlockNewScan(rows.length > 0);
      });
    }, ONGOING_MATCHES_POLL_MS);
    return () => clearInterval(id);
  }, []);

  /**
   * Reprend la recherche si une file était active (localStorage).
   * Dépendances minimales pour ne pas couper le polling lancé par « Initialiser ».
   */
  useEffect(() => {
    if (initialOngoingMatches.length > 0) {
      clearMatchmakingSearch(userId);
      return;
    }
    const p = readMatchmakingSearch();
    if (!p || p.userId !== userId) return;
    const ageMs = Date.now() - Date.parse(p.since);
    if (ageMs > 4 * 60 * 60 * 1000) {
      clearMatchmakingSearch(userId);
      return;
    }
    searchSince.current = new Date(
      Date.parse(p.since) - 15_000,
    ).toISOString();
    setPhase("searching");
    stopPolling();
    const id = setInterval(() => {
      void pollFnRef.current();
    }, MATCHMAKING_POLL_MS);
    pollRef.current = id;
    return () => {
      clearInterval(id);
      if (pollRef.current === id) pollRef.current = null;
    };
  }, [userId, initialOngoingMatches.length, stopPolling]);

  useEffect(() => {
    if (!blockNewScan) return;
    clearMatchmakingSearch(userId);
    stopPolling();
    searchSince.current = null;
    setPhase((ph) => (ph === "searching" ? "idle" : ph));
  }, [blockNewScan, userId, stopPolling]);

  useEffect(() => {
    if (phase !== "matched" || !match) {
      setMatchIntroStep(0);
      return;
    }

    setMatchIntroStep(0);
    const matchId = match.id;
    const STEP_MS = 2200;
    const NAV_MS = 5200;

    const t1 = setTimeout(() => {
      setMatchIntroStep(1);
    }, STEP_MS);
    const t2 = setTimeout(() => {
      router.push(`/play/match/${matchId}`);
    }, NAV_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase, match?.id, router]);

  async function handleJoin() {
    stopPolling();
    setError(null);
    setServiceFallback(false);
    /* Fenêtre avant le clic : évite que created_at (serveur) soit < filtre si l’horloge client est en avance. */
    searchSince.current = new Date(Date.now() - 15_000).toISOString();
    setPhase("searching");

    const res = await joinQueue();
    if ("error" in res && res.error) {
      clearMatchmakingSearch(userId);
      setError(res.error);
      setPhase("idle");
      searchSince.current = null;
      return;
    }

    if ("viaServiceFallback" in res && res.viaServiceFallback) {
      setServiceFallback(true);
    }

    if (
      "matched" in res &&
      res.matched === true &&
      "matchId" in res &&
      typeof res.matchId === "string"
    ) {
      clearMatchmakingSearch(userId);
      const { match: row } = await getMatchById(res.matchId);
      if (row) {
        const m = row as MatchRow;
        setMatch(m);
        resolveOpponent(m);
        setPhase("matched");
        stopPolling();
        return;
      }
    }

    setMatchmakingSearchActive(userId, new Date().toISOString());
    pollRef.current = setInterval(() => {
      void pollFnRef.current();
    }, MATCHMAKING_POLL_MS);
  }

  async function handleLeave() {
    stopPolling();
    searchSince.current = null;
    clearMatchmakingSearch(userId);
    await leaveQueue();
    setPhase("idle");
    setError(null);
  }

  return (
    <div className="relative">
      {error ? (
        <p
          className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {phase === "idle" && (
        <div className="text-center">
          {blockNewScan ? (
            <div className="mx-auto max-w-lg rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-5 py-6 text-left">
              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-amber-200">
                Rencontre en cours
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                Tu as déjà un match non terminé. Termine la salle ou résous le
                litige avant de relancer un scan. La liste est plus bas sur cette
                page.
              </p>
              <Link
                href="#rencontres-en-cours"
                className="mt-4 inline-block font-mono text-xs uppercase tracking-wider text-amber-400 hover:text-amber-300"
              >
                Voir mes rencontres en cours →
              </Link>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-6 max-w-lg text-left">
                <PvpRecordingTip variant="compact" />
              </div>
              <button
                type="button"
                onClick={() => void handleJoin()}
                className="game-btn-primary inline-block min-w-[260px] px-10 py-4 font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-zinc-950"
              >
                <span>Initialiser la recherche</span>
              </button>
              <p className="mx-auto mt-6 max-w-md font-mono text-xs uppercase tracking-wider text-zinc-500">
                Pool mondial · jumelage par ELO (placement et classés)
              </p>
            </>
          )}
        </div>
      )}

      {phase === "searching" && (
        <div className="mx-auto grid w-full max-w-lg grid-cols-2 gap-x-2 gap-y-5 lg:max-w-none lg:grid-cols-[auto_minmax(260px,min(100%,320px))_auto] lg:items-start lg:justify-center lg:gap-x-10 lg:gap-y-0">
          <div className="col-start-1 row-start-1 min-w-0 lg:col-start-1 lg:row-start-1 lg:justify-self-end">
            <PlayerQueueCard displayName={displayName} userId={userId} />
          </div>

          <div className="col-start-2 row-start-1 min-w-0 lg:col-start-3 lg:row-start-1 lg:justify-self-start">
            <OpponentProbeCard />
          </div>

          <div className="col-span-2 flex w-full flex-col items-center justify-center py-1 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:max-w-[min(100%,320px)] lg:justify-self-center lg:py-4">
            <div className="search-rings relative flex h-36 w-36 shrink-0 items-center justify-center sm:h-44 sm:w-44 lg:h-48 lg:w-48">
              <span className="absolute inset-0 rounded-full border-2 border-amber-500/35 search-ring-1" />
              <span className="absolute inset-5 rounded-full border-2 border-amber-400/30 search-ring-2" />
              <span className="absolute inset-10 rounded-full border border-amber-300/25 search-ring-3" />
              <span className="relative z-10 bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-center font-[family-name:var(--font-bebas)] text-2xl tracking-[0.2em] text-transparent drop-shadow-[0_0_20px_rgba(251,191,36,0.5)] lg:text-3xl">
                SCAN
              </span>
            </div>
            <p className="mt-6 max-w-xs animate-pulse text-center font-mono text-xs uppercase tracking-[0.25em] text-amber-400/85 lg:mt-8 lg:text-sm">
              Recherche d&apos;un adversaire…
            </p>
            {serviceFallback ? (
              <p className="mx-auto mt-3 max-w-sm text-center text-xs leading-relaxed text-zinc-500 lg:mt-4">
                Mode secours actif (RPC indisponible). Tu es bien en file — exécute le SQL des migrations
                sur Supabase pour l’appariement standard.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleLeave()}
              className="game-btn-leave mt-6 w-full max-w-xs px-5 py-3 font-[family-name:var(--font-bebas)] text-base tracking-[0.12em] text-zinc-100 lg:mt-8 lg:max-w-sm lg:px-8 lg:py-3.5 lg:text-lg"
            >
              <span>
                <svg
                  className="h-5 w-5 shrink-0 text-red-300/90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                  />
                </svg>
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-zinc-200 lg:text-xs lg:tracking-[0.22em]">
                  Abandonner la file
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      {phase === "matched" && match && (
        <div className="match-found mm-match-reveal-ring relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-xl border border-amber-400/50 bg-gradient-to-b from-amber-500/20 via-zinc-950/80 to-zinc-950 px-6 py-14 text-center shadow-[0_0_48px_rgba(245,158,11,0.12)] sm:min-h-[320px] sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.12),transparent_65%)]" />
          {matchIntroStep === 0 ? (
            <div
              key="intro-found"
              className="mm-match-reveal-panel relative flex flex-col items-center"
            >
              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-amber-300">
                Adversaire trouvé
              </p>
              <p className="game-title mt-5 font-[family-name:var(--font-bebas)] text-5xl tracking-wide text-white sm:text-6xl">
                {opponentLabel}
              </p>
              <p className="mt-5 max-w-md text-sm text-zinc-400">
                Verrouillage de la cible — préparation de la rencontre.
              </p>
            </div>
          ) : (
            <div
              key="intro-create"
              className="mm-match-reveal-panel relative flex flex-col items-center"
            >
              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-amber-300">
                Rencontre
              </p>
              <p className="game-title mt-5 max-w-md font-[family-name:var(--font-bebas)] text-3xl leading-tight tracking-wide text-white sm:text-4xl">
                La rencontre est en cours de création
              </p>
              <div
                className="mt-8 flex items-center gap-3"
                role="status"
                aria-live="polite"
              >
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Ouverture de la salle…
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <OngoingMatchesBlock
        userId={userId}
        initialRows={initialOngoingMatches}
        placementMatchesPlayed={placementMatchesPlayed}
      />

      <div className="mt-10">
        <Link
          href="/play"
          className="font-mono text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
        >
          ← QG
        </Link>
      </div>
    </div>
  );
}
