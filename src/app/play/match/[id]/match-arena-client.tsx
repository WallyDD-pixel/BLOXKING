"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  getMatchById,
  listDisputeChatMessages,
  listDisputeTickets,
  matchConfirmStarted,
  matchFinalize,
  matchResetAfterDispute,
  matchSubmitDisputeTicket,
  matchSubmitScoreClaim,
  postDisputeChatMessage,
  type DisputeChatMessageRow,
  type DisputeTicketRow,
  type MatchCancellationRequestRow,
} from "@/app/play/actions";
import { isPlacementComplete, type RankedStatsPublic } from "@/lib/ranked";
import { DisputeEvidencePreview } from "@/components/match/dispute-evidence-preview";
import { DisputeEvidenceUpload } from "@/components/match/dispute-evidence-upload";
import { MatchDisputeOpenForm } from "@/components/match/match-dispute-open-form";
import { MatchOpponentChatWidget } from "@/components/match/match-opponent-chat-widget";
import { MatchCancellationRequest } from "@/components/match/match-cancellation-request";
import { PvpRecordingTip } from "@/components/pvp-recording-tip";
import {
  countVideosInPaths,
  DISPUTE_MAX_ATTACHMENTS,
  DISPUTE_MAX_VIDEOS_PER_BATCH,
} from "@/lib/dispute-evidence";
import { uploadDisputeEvidenceClient } from "@/lib/upload-dispute-evidence-client";
import { PVP_RECORDING_DISPUTE_HINT } from "@/lib/pvp-recording-copy";
import { formatDateTimeFr } from "@/lib/format-datetime";
import {
  MATCH_ARENA_REFRESH_MS,
  MATCH_DISPUTE_POLL_MS,
} from "@/lib/polling/constants";
import {
  MATCH_START_DEADLINE_MS,
  formatCountdownMs,
  matchAbandonDeadlineMs,
  matchStartDeadlineMs,
} from "@/lib/match/match-start-deadline";

const START_DEADLINE_MINUTES = MATCH_START_DEADLINE_MS / 60_000;

export type MatchArenaRow = {
  id: string;
  player_a: string;
  player_b: string;
  player_a_label: string | null;
  player_b_label: string | null;
  player_a_roblox: string | null;
  player_b_roblox: string | null;
  source: string;
  status: string;
  match_started_a?: boolean;
  match_started_b?: boolean;
  claim_from_a_maps_a: number | null;
  claim_from_a_maps_b: number | null;
  claim_from_b_maps_a: number | null;
  claim_from_b_maps_b: number | null;
  b_accepts_a_claim?: boolean;
  a_accepts_b_claim?: boolean;
  dispute?: boolean;
  cancel_reason?: string | null;
  created_at: string;
  elo_delta_a?: number | null;
  elo_delta_b?: number | null;
};

/** Résultats BO3 (repère global : maps gagnées par A, maps gagnées par B). */
const BO3_OUTCOMES: { mapsA: number; mapsB: number }[] = [
  { mapsA: 2, mapsB: 0 },
  { mapsA: 2, mapsB: 1 },
  { mapsA: 1, mapsB: 2 },
  { mapsA: 0, mapsB: 2 },
];

function iWonOutcome(isPlayerA: boolean, o: { mapsA: number; mapsB: number }): boolean {
  return isPlayerA ? o.mapsA > o.mapsB : o.mapsB > o.mapsA;
}

function perspectiveOutcomeLabel(
  isPlayerA: boolean,
  o: { mapsA: number; mapsB: number },
): string {
  const my = isPlayerA ? o.mapsA : o.mapsB;
  const opp = isPlayerA ? o.mapsB : o.mapsA;
  if (iWonOutcome(isPlayerA, o)) {
    return `J'ai gagné ${my}-${opp}`;
  }
  return `Mon adversaire a gagné ${opp}-${my}`;
}

function splitOutcomeIndices(isPlayerA: boolean): {
  wins: number[];
  losses: number[];
} {
  const wins: number[] = [];
  const losses: number[] = [];
  BO3_OUTCOMES.forEach((o, i) => {
    (iWonOutcome(isPlayerA, o) ? wins : losses).push(i);
  });
  return { wins, losses };
}

function claimInt(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function claimsMatch(m: MatchArenaRow): boolean {
  const aa = claimInt(m.claim_from_a_maps_a);
  const ab = claimInt(m.claim_from_a_maps_b);
  const ba = claimInt(m.claim_from_b_maps_a);
  const bb = claimInt(m.claim_from_b_maps_b);
  if (aa == null || ab == null || ba == null || bb == null) return false;
  return aa === ba && ab === bb;
}

function canFinalizeMatch(m: MatchArenaRow): boolean {
  if (m.status === "confirmed") return false;
  if (!m.match_started_a || !m.match_started_b) return false;
  if (m.dispute || m.status === "disputed") return false;
  if (!claimsMatch(m)) return false;
  return true;
}

/** Pourquoi le bouton « Terminer » reste inactif (vue joueur courant). */
function finalizeHints(m: MatchArenaRow, viewerIsA: boolean): string[] {
  const hints: string[] = [];
  if (m.status === "confirmed") return hints;
  if (!m.match_started_a || !m.match_started_b) {
    hints.push("Les deux joueurs doivent confirmer le début (étape 1).");
  }
  if (m.dispute || m.status === "disputed") {
    hints.push(
      "Un litige est ouvert : modifie ta déclaration (étape 2) pour vous mettre d’accord, ou réinitialise la saisie.",
    );
  }

  const mySent = viewerIsA
    ? claimInt(m.claim_from_a_maps_a) != null
    : claimInt(m.claim_from_b_maps_a) != null;
  const oppSent = viewerIsA
    ? claimInt(m.claim_from_b_maps_a) != null
    : claimInt(m.claim_from_a_maps_a) != null;

  if (!mySent) {
    hints.push(
      "Envoie ta déclaration avec « Déclarer et envoyer mon score » (même résultat que celui que tu reconnais, ex. 2-0).",
    );
  }
  if (!oppSent) {
    hints.push("L’adversaire doit encore envoyer sa déclaration.");
  }
  if (mySent && oppSent && !claimsMatch(m)) {
    hints.push(
      "Les deux déclarations ne sont pas identiques — alignez-vous sur le même score.",
    );
  }

  return hints;
}

export function MatchArenaClient({
  matchId,
  userId,
  initialMatch,
  initialRankedA,
  initialRankedB,
  sourceLabel,
  initialCancellationRequests = [],
}: {
  matchId: string;
  userId: string;
  initialMatch: MatchArenaRow;
  initialRankedA: RankedStatsPublic | null;
  initialRankedB: RankedStatsPublic | null;
  sourceLabel: string;
  initialCancellationRequests?: MatchCancellationRequestRow[];
}) {
  const router = useRouter();
  const [m, setM] = useState<MatchArenaRow>(initialMatch);
  const [rankedA, setRankedA] = useState<RankedStatsPublic | null>(
    initialRankedA,
  );
  const [rankedB, setRankedB] = useState<RankedStatsPublic | null>(
    initialRankedB,
  );
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [outcomeIdx, setOutcomeIdx] = useState(0);
  const [disputeTickets, setDisputeTickets] = useState<DisputeTicketRow[]>([]);
  const [disputeDraft, setDisputeDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [disputeFlowOpen, setDisputeFlowOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [disputeEvidencePaths, setDisputeEvidencePaths] = useState<string[]>([]);
  const [followUpEvidencePaths, setFollowUpEvidencePaths] = useState<string[]>([]);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState<DisputeChatMessageRow[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isA = m.player_a === userId;
  const labelA = m.player_a_label ?? "Joueur A";
  const labelB = m.player_b_label ?? "Joueur B";
  const robloxA = m.player_a_roblox ?? m.player_a_label ?? "—";
  const robloxB = m.player_b_roblox ?? m.player_b_label ?? "—";

  const myStarted = isA ? !!m.match_started_a : !!m.match_started_b;
  const oppStarted = isA ? !!m.match_started_b : !!m.match_started_a;
  const bothStarted = !!m.match_started_a && !!m.match_started_b;
  const inDispute = !!(m.dispute || m.status === "disputed");
  const startDeadlineMs = matchStartDeadlineMs(m.created_at);
  const startCountdownMs = Math.max(0, startDeadlineMs - nowMs);
  const startDeadlinePassed =
    m.status === "pending" && !bothStarted && startCountdownMs <= 0;
  const abandonDeadlineMs = matchAbandonDeadlineMs(m.created_at);
  const abandonCountdownMs = Math.max(0, abandonDeadlineMs - nowMs);
  const showAbandonWarning =
    m.status === "pending" && !inDispute && abandonCountdownMs > 0;

  const myClaimA = isA ? m.claim_from_a_maps_a : m.claim_from_b_maps_a;
  const myClaimB = isA ? m.claim_from_a_maps_b : m.claim_from_b_maps_b;
  const hasMyClaim = myClaimA != null && myClaimB != null;

  const oppClaimA = isA ? m.claim_from_b_maps_a : m.claim_from_a_maps_a;
  const oppClaimB = isA ? m.claim_from_b_maps_b : m.claim_from_a_maps_b;
  const hasOppClaim = oppClaimA != null && oppClaimB != null;

  useEffect(() => {
    if (m.status !== "pending" || inDispute) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [m.status, inDispute]);

  /** Accord des deux déclarations : verrouillé sauf en litige (où on peut corriger). */
  const scoreLocked = claimsMatch(m) && !inDispute;

  const finalizeHintsList = useMemo(
    () => finalizeHints(m, isA),
    [m, isA],
  );

  const refresh = useCallback(async () => {
    const { match, rankedA: nextA, rankedB: nextB } =
      await getMatchById(matchId);
    if (match) setM(match as MatchArenaRow);
    setRankedA(nextA);
    setRankedB(nextB);
  }, [matchId]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refresh();
    }, MATCH_ARENA_REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (myClaimA == null || myClaimB == null) return;
    const a = Number(myClaimA);
    const b = Number(myClaimB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    const idx = BO3_OUTCOMES.findIndex(
      (o) => o.mapsA === a && o.mapsB === b,
    );
    if (idx >= 0) setOutcomeIdx(idx);
  }, [myClaimA, myClaimB]);

  const refreshDisputeThreads = useCallback(async () => {
    const [{ messages }, { tickets }] = await Promise.all([
      listDisputeChatMessages(matchId),
      listDisputeTickets(matchId),
    ]);
    setChatMessages(messages);
    setDisputeTickets(tickets);
  }, [matchId]);

  useEffect(() => {
    if (m.status === "confirmed") {
      setDisputeTickets([]);
      setChatMessages([]);
      setChatDraft("");
      return;
    }
    void refreshDisputeThreads();
    const t = setInterval(() => void refreshDisputeThreads(), MATCH_DISPUTE_POLL_MS);
    return () => clearInterval(t);
  }, [m.status, matchId, refreshDisputeThreads]);

  const firstTicketOpenerId = useMemo(
    () => disputeTickets[0]?.opened_by ?? null,
    [disputeTickets],
  );

  useEffect(() => {
    if (m.dispute || m.status === "disputed") {
      setDisputeDraft("");
      setDisputeFlowOpen(false);
      setDisputeEvidencePaths([]);
      setFollowUpDraft("");
      setFollowUpOpen(false);
      setFollowUpEvidencePaths([]);
    }
  }, [m.dispute, m.status]);

  const appendEvidenceFiles = useCallback(
    async (
      fileList: FileList | null,
      currentPaths: string[],
      setPaths: Dispatch<SetStateAction<string[]>>,
    ) => {
      if (!fileList?.length) return;
      const room = DISPUTE_MAX_ATTACHMENTS - currentPaths.length;
      if (room <= 0) return;
      const files = Array.from(fileList).slice(0, room);
      setEvidenceBusy(true);
      setErr(null);
      let batch = [...currentPaths];
      try {
        for (const file of files) {
          const maybeVideo =
            file.type.startsWith("video/") ||
            /\.(mp4|webm)$/i.test(file.name);
          if (maybeVideo && countVideosInPaths(batch) >= DISPUTE_MAX_VIDEOS_PER_BATCH) {
            setErr("Une seule vidéo par message (max. 50 Mo, MP4 ou WebM).");
            return;
          }
          const res = await uploadDisputeEvidenceClient(matchId, file);
          if ("error" in res && res.error) {
            setErr(res.error);
            return;
          }
          if ("path" in res && res.path) {
            batch = [...batch, res.path];
            setPaths(batch);
          }
        }
      } finally {
        setEvidenceBusy(false);
      }
    },
    [matchId],
  );

  const displayScore = useMemo(() => {
    if (claimsMatch(m)) {
      return {
        a: m.claim_from_a_maps_a ?? 0,
        b: m.claim_from_a_maps_b ?? 0,
        consensus: true as const,
      };
    }
    return { a: 0, b: 0, consensus: false as const };
  }, [m]);

  function run(
    action: () => Promise<{ error?: string; ok?: boolean } | undefined>,
  ) {
    setErr(null);
    startTransition(() => {
      void (async () => {
        const res = await action();
        if (res && "error" in res && res.error) {
          setErr(res.error);
          return;
        }
        await refresh();
        router.refresh();
      })();
    });
  }

  const outcomeGroups = useMemo(() => splitOutcomeIndices(isA), [isA]);

  const globalFromSelection = () => {
    const o = BO3_OUTCOMES[outcomeIdx];
    return { mapsWonA: o.mapsA, mapsWonB: o.mapsB };
  };

  const finalizeDisabled = !canFinalizeMatch(m) || m.status === "confirmed";
  const confirmed = m.status === "confirmed";
  const eloDeltaA = claimInt(m.elo_delta_a);
  const eloDeltaB = claimInt(m.elo_delta_b);
  const eloDeltasReady =
    confirmed &&
    displayScore.consensus &&
    eloDeltaA != null &&
    eloDeltaB != null;
  const aWinsBo3 =
    displayScore.consensus && displayScore.a > displayScore.b;
  const winnerEloDelta =
    eloDeltasReady && aWinsBo3 ? eloDeltaA : eloDeltasReady ? eloDeltaB : null;
  const loserEloDelta =
    eloDeltasReady && aWinsBo3 ? eloDeltaB : eloDeltasReady ? eloDeltaA : null;

  function formatEloDelta(n: number): string {
    return `${n >= 0 ? "+" : ""}${n} ELO`;
  }

  if (m.status === "cancelled") {
    const startTimeout =
      m.cancel_reason === "start_timeout" ||
      (!m.cancel_reason &&
        !m.match_started_a &&
        !m.match_started_b &&
        !m.dispute);
    const abandoned = m.cancel_reason === "abandoned";
    const disputeTimeout = m.cancel_reason === "dispute_timeout";
    const playerRequest = m.cancel_reason === "player_request";
    const adminCancel = m.cancel_reason === "admin";

    return (
      <div className="match-arena-root space-y-8 sm:space-y-10">
        <section className="game-panel rounded-2xl border border-zinc-700/60 bg-zinc-950/80 px-5 py-8 sm:px-8 sm:py-10">
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-zinc-500">
            Rencontre classée
          </p>
          <h2 className="game-title mt-3 font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-white sm:text-4xl">
            Match annulé
          </h2>
          {startTimeout ? (
            <>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-zinc-400 sm:text-[0.95rem]">
                Les deux joueurs n&apos;ont pas confirmé le début du combat dans
                les{" "}
                <strong className="font-medium text-zinc-200">
                  {START_DEADLINE_MINUTES} minutes
                </strong>{" "}
                après la création du match. Le match a été annulé automatiquement
                — aucun ELO n&apos;a changé.
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                Tu peux relancer une recherche matchmaking.
              </p>
            </>
          ) : abandoned ? (
            <>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-zinc-400 sm:text-[0.95rem]">
                Ce match est resté en cours plus de{" "}
                <strong className="font-medium text-zinc-200">25 minutes</strong>{" "}
                sans être clôturé et sans litige déclaré. Il a été annulé comme
                match abandonné — aucun ELO n&apos;a changé.
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                Tu peux relancer une recherche matchmaking.
              </p>
            </>
          ) : disputeTimeout ? (
            <>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-zinc-400 sm:text-[0.95rem]">
                Un litige avec ticket modération est resté sans résolution pendant
                plus de{" "}
                <strong className="font-medium text-zinc-200">30 minutes</strong>{" "}
                après l&apos;ouverture du ticket. Aucun résultat ranked ni changement
                d&apos;ELO n&apos;est enregistré.
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                Tu peux relancer une recherche matchmaking : ce match ne bloque plus
                ta file.
              </p>
            </>
          ) : playerRequest || adminCancel ? (
            <>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-zinc-400 sm:text-[0.95rem]">
                {playerRequest
                  ? "Un modérateur a annulé ce match suite à une demande d'annulation."
                  : "Un modérateur a annulé ce match."}{" "}
                Aucun résultat ranked ni changement d&apos;ELO n&apos;est enregistré.
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                Tu peux relancer une recherche matchmaking.
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-zinc-400 sm:text-[0.95rem]">
                Ce match a été annulé. Aucun résultat ranked ni changement
                d&apos;ELO n&apos;est enregistré.
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                Tu peux relancer une recherche matchmaking.
              </p>
            </>
          )}
          <Link
            href="/play/recherche"
            className="game-btn-primary mt-8 inline-flex min-h-[3rem] items-center justify-center px-8 py-3 font-[family-name:var(--font-bebas)] text-xl tracking-wide text-zinc-950"
          >
            <span>Retour à la recherche</span>
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="match-arena-root space-y-8 sm:space-y-10">
      {err ? (
        <p
          className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3.5 text-sm leading-relaxed text-red-200 sm:px-5"
          role="alert"
        >
          {err}
        </p>
      ) : null}

      {showAbandonWarning ? (
        <p
          className="rounded-xl border border-zinc-600/50 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400"
          role="status"
        >
          Sans litige ni clôture, ce match sera annulé comme abandonné dans{" "}
          <strong className="font-medium text-amber-200/95">
            {formatCountdownMs(abandonCountdownMs)}
          </strong>{" "}
          (limite 25 min depuis la création).
        </p>
      ) : null}

      {/* Toujours 3 colonnes côte à côte (carte · score · carte) */}
      <div className="match-arena-vs-wrap flex w-full min-w-0 flex-row items-stretch gap-1.5 sm:gap-3 md:gap-4 lg:gap-6">
        <div className="flex min-h-[10rem] min-w-0 flex-1 basis-0 sm:min-h-[11rem] md:min-h-[12rem] lg:min-h-[13rem]">
          <PlayerCard
            highlight={isA}
            label={labelA}
            roblox={String(robloxA)}
            subtitle="Joueur A"
            started={!!m.match_started_a}
            ranked={rankedA}
            matchClosed={confirmed}
            closedEloDelta={confirmed ? eloDeltaA : null}
          />
        </div>

        <div
          className="match-score-hub relative flex w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-950/50 via-zinc-950/90 to-black px-1 py-4 text-center sm:w-36 sm:rounded-2xl sm:px-2 sm:py-5 md:w-44 md:px-3 md:py-6 lg:w-52 lg:px-6"
          aria-live="polite"
        >
          <span
            className="pointer-events-none absolute inset-x-2 top-2 h-px bg-gradient-to-r from-transparent via-amber-500/25 to-transparent sm:inset-x-3 md:inset-x-6 md:top-3"
            aria-hidden
          />
          <p className="font-mono text-[0.4rem] uppercase leading-tight tracking-[0.12em] text-amber-500/85 sm:text-[0.5rem] sm:tracking-[0.2em] md:text-[0.55rem] lg:text-[0.6rem] lg:tracking-[0.35em]">
            <span className="sm:hidden">BO3</span>
            <span className="hidden sm:inline">Score BO3</span>
          </p>
          <p className="game-title mt-1 font-[family-name:var(--font-bebas)] text-3xl leading-none tracking-wide text-white sm:mt-3 sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
            <span className="tabular-nums">{displayScore.a}</span>
            <span className="mx-0.5 text-amber-500/40 sm:mx-1 md:mx-2">—</span>
            <span className="tabular-nums">{displayScore.b}</span>
          </p>
          {!displayScore.consensus && bothStarted ? (
            <>
              <p className="mt-1 line-clamp-2 font-mono text-[0.45rem] leading-tight text-zinc-500 sm:hidden">
                {m.dispute ? "Litige" : "En attente"}
              </p>
              <p className="mt-2 hidden font-mono text-[0.6rem] leading-snug text-zinc-500 sm:mt-3 sm:block sm:px-0.5 sm:text-[0.55rem] md:mt-4 md:text-xs">
                {m.dispute
                  ? "Litige ou désaccord sur le score."
                  : "En attente de déclarations identiques."}
              </p>
            </>
          ) : null}
          {displayScore.consensus && !confirmed ? (
            <>
              <p className="mt-1 font-mono text-[0.45rem] text-emerald-400/95 sm:hidden">
                OK
              </p>
              <p className="mt-2 hidden font-mono text-[0.65rem] text-emerald-400/95 sm:mt-4 sm:block sm:text-xs">
                Même résultat déclaré des deux côtés
              </p>
            </>
          ) : null}
          {confirmed ? (
            <>
              <p className="mt-1 font-mono text-[0.45rem] uppercase text-emerald-400 sm:hidden">
                Fin
              </p>
              <p className="mt-2 hidden font-mono text-[0.55rem] uppercase leading-tight tracking-wider text-emerald-400 sm:mt-4 sm:block sm:text-xs">
                Match clôturé
              </p>
              {eloDeltasReady && winnerEloDelta != null && loserEloDelta != null ? (
                <div
                  className="mt-2 hidden max-w-[11rem] flex-col gap-1 sm:flex md:max-w-none"
                  role="status"
                >
                  <p className="font-mono text-[0.55rem] leading-snug text-emerald-300/95 md:text-[0.6rem]">
                    Gagnant ·{" "}
                    <span className="font-semibold text-emerald-200">
                      {aWinsBo3 ? labelA : labelB}
                    </span>
                    <br />
                    <span className="tabular-nums">
                      {formatEloDelta(winnerEloDelta)}
                    </span>
                  </p>
                  <p className="font-mono text-[0.55rem] leading-snug text-rose-300/90 md:text-[0.6rem]">
                    Perdant ·{" "}
                    <span className="font-semibold text-rose-200/95">
                      {aWinsBo3 ? labelB : labelA}
                    </span>
                    <br />
                    <span className="tabular-nums">
                      {formatEloDelta(loserEloDelta)}
                    </span>
                  </p>
                </div>
              ) : displayScore.consensus ? (
                <p className="mt-2 hidden font-mono text-[0.5rem] text-zinc-500 sm:block sm:max-w-[10rem] sm:text-[0.55rem]">
                  Variations ELO non enregistrées pour ce match.
                </p>
              ) : null}
              {eloDeltasReady &&
              winnerEloDelta != null &&
              loserEloDelta != null ? (
                <div
                  className="mt-1.5 flex flex-col gap-0.5 sm:hidden"
                  role="status"
                >
                  <p className="font-mono text-[0.42rem] leading-tight text-emerald-300/95">
                    Gagnant {formatEloDelta(winnerEloDelta)}
                  </p>
                  <p className="font-mono text-[0.42rem] leading-tight text-rose-300/85">
                    Perdant {formatEloDelta(loserEloDelta)}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex min-h-[10rem] min-w-0 flex-1 basis-0 sm:min-h-[11rem] md:min-h-[12rem] lg:min-h-[13rem]">
          <PlayerCard
            highlight={!isA}
            label={labelB}
            roblox={String(robloxB)}
            subtitle="Joueur B"
            started={!!m.match_started_b}
            ranked={rankedB}
            matchClosed={confirmed}
            closedEloDelta={confirmed ? eloDeltaB : null}
          />
        </div>
      </div>

      <div className="flex justify-center px-1">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/90 px-4 py-2 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:text-[0.65rem] sm:tracking-[0.22em]">
          <span className="text-amber-600/90">{sourceLabel}</span>
          <span className="text-zinc-700">·</span>
          <span
            className={
              confirmed
                ? "text-emerald-500/95"
                : m.dispute || m.status === "disputed"
                  ? "text-amber-500/95"
                  : "text-zinc-400"
            }
          >
            {confirmed
              ? "confirmé"
              : m.dispute || m.status === "disputed"
                ? "litige"
                : m.status}
          </span>
        </p>
      </div>

      {/* 1. Début mutuel */}
      {!confirmed ? (
        <section className="game-panel rounded-2xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="border-l-2 border-amber-500/40 pl-3 sm:pl-4">
            <h2 className="match-arena-step-title font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-amber-500/90 sm:text-[0.7rem] sm:tracking-[0.32em]">
              <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-amber-500/35 bg-amber-500/10 px-1.5 text-[0.6rem] text-amber-200">
                1
              </span>
              <span>Début de la rencontre</span>
            </h2>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-zinc-400 sm:text-[0.95rem]">
              Les deux joueurs doivent confirmer que la partie a bien commencé en
              jeu avant la saisie du score.{" "}
              <strong className="font-medium text-amber-200/95">
                Délai : {formatCountdownMs(startCountdownMs)}
              </strong>{" "}
              — sinon le match est annulé et vous pourrez relancer une recherche.{" "}
              <strong className="font-medium text-zinc-200">
                Lance l&apos;enregistrement du combat maintenant
              </strong>{" "}
              : en cas de litige, c&apos;est ta preuve la plus fiable. Pour parler
              à l&apos;adversaire (salon, ready…), ouvre la{" "}
              <strong className="font-medium text-emerald-300/95">
                bulle Messages
              </strong>{" "}
              en bas à droite.
            </p>
          </div>
          {startDeadlinePassed ? (
            <p
              className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95"
              role="status"
            >
              Délai écoulé — annulation en cours… Recharge dans quelques secondes
              ou retourne à la recherche.
            </p>
          ) : null}
          <PvpRecordingTip variant="callout" className="mt-6" />
          <div className="mt-6 flex flex-col gap-4 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            {myStarted ? (
              <div className="flex w-full min-h-[3rem] items-center justify-center gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.09] px-5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:w-auto">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-400"
                  aria-hidden
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </span>
                <span className="text-center font-mono text-sm font-medium text-emerald-100/95 sm:text-base">
                  Tu as confirmé le début
                </span>
              </div>
            ) : (
              <button
                type="button"
                disabled={pending || startDeadlinePassed}
                onClick={() => run(() => matchConfirmStarted(matchId))}
                className="game-btn-primary w-full min-h-[3rem] px-5 py-3.5 disabled:opacity-50 sm:w-auto sm:min-h-0 sm:px-6 sm:py-3"
              >
                <span className="text-center text-[0.95rem] sm:text-base">
                  Confirmer le début (ma partie a commencé)
                </span>
              </button>
            )}
            <p className="font-mono text-xs text-zinc-500 sm:text-[0.8rem]">
              <span className="text-zinc-600">Adversaire</span>
              <span className="mx-2 text-zinc-700">·</span>
              {oppStarted ? (
                <span className="font-medium text-emerald-400/95">confirmé</span>
              ) : (
                <span className="text-amber-500/75">en attente</span>
              )}
            </p>
          </div>
        </section>
      ) : null}

      {/* 2. Déclaration BO3 */}
      {bothStarted && !confirmed ? (
        <section className="game-panel rounded-2xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="border-l-2 border-amber-500/40 pl-3 sm:pl-4">
            <h2 className="match-arena-step-title font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-amber-500/90 sm:text-[0.7rem] sm:tracking-[0.32em]">
              <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-amber-500/35 bg-amber-500/10 px-1.5 text-[0.6rem] text-amber-200">
                2
              </span>
              <span>Déclaration BO3</span>
            </h2>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-zinc-400 sm:text-[0.95rem]">
              Choisis le résultat final (premier à 2 manches) et envoie ta
              déclaration. L&apos;adversaire fait pareil de son côté — les deux
              doivent indiquer le même score pour clôturer. Garde ton enregistrement
              combat sous la main si le score est contesté.
            </p>
          </div>

          {!inDispute ? (
            <PvpRecordingTip variant="compact" className="mt-6" />
          ) : null}

          {inDispute ? (
            <div className="mt-6 space-y-6 rounded-xl border border-amber-600/45 bg-gradient-to-br from-amber-500/12 to-zinc-950/60 px-4 py-5 sm:px-6 sm:py-6">
              <div className="rounded-xl border border-amber-500/35 bg-black/30 px-4 py-4 sm:px-5 sm:py-5">
                <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-amber-200/95">
                  Litige ouvert — que se passe-t-il ?
                </p>
                {firstTicketOpenerId == null ? (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-[0.95rem]">
                    Un litige est actif sur ce match. Utilise le{" "}
                    <strong className="font-medium text-zinc-100">
                      bulle Messages en bas à droite
                    </strong>{" "}
                    pour tenter de vous mettre d&apos;accord, le{" "}
                    <strong className="font-medium text-zinc-100">
                      dossier modération
                    </strong>{" "}
                    pour les preuves, ou{" "}
                    <strong className="font-medium text-zinc-100">
                      modifiez vos déclarations
                    </strong>{" "}
                    plus bas si vous convenez du même score.
                  </p>
                ) : firstTicketOpenerId === userId ? (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-[0.95rem]">
                    <strong className="font-medium text-amber-100/95">
                      Tu as ouvert
                    </strong>{" "}
                    la demande de litige (ticket modération) : tu n&apos;es pas
                    d&apos;accord avec la situation ou une déclaration.
                    L&apos;adversaire peut{" "}
                    <strong className="font-medium text-zinc-100">
                      répondre avec ses preuves
                    </strong>{" "}
                    dans le fil modération et{" "}
                    <strong className="font-medium text-zinc-100">
                      discuter avec toi via la bulle Messages
                    </strong>
                    . Tu peux aussi{" "}
                    <strong className="font-medium text-zinc-100">
                      corriger ta déclaration
                    </strong>{" "}
                    ci-dessous si vous vous alignez sur le score.
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-[0.95rem]">
                    <strong className="font-medium text-amber-100/95">
                      Ton adversaire a ouvert un litige
                    </strong>{" "}
                    : il n&apos;est pas d&apos;accord avec ta déclaration (ou
                    avec le déroulé du match).{" "}
                    <strong className="font-medium text-zinc-100">
                      Ajoute tes preuves
                    </strong>{" "}
                    (captures, explications) via les messages modération, et{" "}
                    <strong className="font-medium text-zinc-100">
                      échange via la bulle Messages
                    </strong>{" "}
                    pour clarifier le score ou convenir d&apos;un arrangement.
                    Vous pouvez aussi{" "}
                    <strong className="font-medium text-zinc-100">
                      modifier vos déclarations
                    </strong>{" "}
                    ci-dessous : si les deux scores concordent, le litige se
                    lève automatiquement.
                  </p>
                )}
                <p className="mt-3 border-t border-white/10 pt-3 font-mono text-[0.55rem] leading-relaxed text-zinc-500">
                  Chaque message est horodaté côté serveur : des notifications
                  (push, e-mail) pourront plus tard prévenir l&apos;adversaire ou
                  l&apos;équipe lors d&apos;une nouvelle activité sur ce litige.
                </p>
              </div>

              <PvpRecordingTip variant="compact" />

              <div>
                <p className="font-mono text-sm font-semibold uppercase tracking-wider text-amber-200">
                  Dossier modération (équipe)
                </p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-[0.95rem]">
                  Chaque entrée ci-dessous documente le litige pour les
                  modérateurs (faits, captures, extraits vidéo). Les deux joueurs y
                  ont accès en lecture. Utilise « Ajouter un message » pour
                  compléter le dossier —{" "}
                  <strong className="font-medium text-zinc-100">
                    une vidéo ou un clip du combat
                  </strong>{" "}
                  vaut mieux qu&apos;un simple texte. {PVP_RECORDING_DISPUTE_HINT}
                </p>
              </div>

              {disputeTickets.length > 0 ? (
                <ul className="space-y-3 rounded-lg border border-white/10 bg-black/25 p-3 sm:p-4">
                  <p className="font-mono text-[0.55rem] uppercase tracking-wider text-zinc-500">
                    Fil du ticket
                  </p>
                  {disputeTickets.map((t) => {
                    const mine = t.opened_by === userId;
                    const when = formatDateTimeFr(t.created_at, {
                      dateStyle: "short",
                      timeStyle: "short",
                    });
                    return (
                      <li
                        key={t.id}
                        className="rounded-md border border-white/8 bg-zinc-950/60 px-3 py-2.5"
                      >
                        <p className="font-mono text-[0.6rem] text-zinc-500">
                          {mine ? "Toi" : "Adversaire"} · {when}
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                          {t.body}
                        </p>
                        {t.attachment_paths.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-3">
                            {t.attachment_paths.map((p, i) => (
                              <a
                                key={p}
                                href={t.attachment_urls[i]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                              >
                                <DisputeEvidencePreview
                                  url={t.attachment_urls[i]}
                                  objectPath={p}
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-600/80 bg-zinc-950/40 px-3 py-3 text-sm text-zinc-500">
                  Aucun message sur ce ticket pour l&apos;instant — ajoute une
                  explication ci-dessous.
                </p>
              )}

              {!followUpOpen ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setFollowUpOpen(true)}
                  className="w-full rounded-xl border border-amber-500/35 bg-zinc-950/50 px-4 py-3.5 text-left text-sm font-medium text-amber-100/95 transition-colors hover:bg-amber-500/10 sm:text-[0.95rem]"
                >
                  Ajouter un message ou des preuves (nouveau message modération)
                </button>
              ) : (
                <div className="rounded-xl border border-white/12 bg-zinc-950/50 px-4 py-4">
                  <label className="block font-mono text-[0.6rem] uppercase tracking-wider text-zinc-500">
                    Précision pour l&apos;équipe
                  </label>
                  <textarea
                    value={followUpDraft}
                    onChange={(e) => setFollowUpDraft(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Minimum 10 caractères — décris les faits et ce que tu proposes. Tu peux joindre une vidéo du combat ci-dessous."
                    className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                  />
                  <p className="mt-1 font-mono text-[0.55rem] text-zinc-600">
                    {followUpDraft.trim().length}/2000 · min. 10
                  </p>
                  <DisputeEvidenceUpload
                    paths={followUpEvidencePaths}
                    setPaths={setFollowUpEvidencePaths}
                    disabled={pending}
                    busy={evidenceBusy}
                    onPickFiles={appendEvidenceFiles}
                  />
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      disabled={pending || followUpDraft.trim().length < 10}
                      onClick={() => {
                        const msg = followUpDraft.trim();
                        if (msg.length < 10) return;
                        setErr(null);
                        startTransition(() => {
                          void (async () => {
                            const res = await matchSubmitDisputeTicket(
                              matchId,
                              msg,
                              followUpEvidencePaths,
                            );
                            if (res?.error) {
                              setErr(res.error);
                              return;
                            }
                            setFollowUpDraft("");
                            setFollowUpEvidencePaths([]);
                            setFollowUpOpen(false);
                            const {
                              match: next,
                              rankedA: na,
                              rankedB: nb,
                            } = await getMatchById(matchId);
                            if (next) setM(next as MatchArenaRow);
                            setRankedA(na);
                            setRankedB(nb);
                            const { tickets } = await listDisputeTickets(matchId);
                            setDisputeTickets(tickets);
                            router.refresh();
                          })();
                        });
                      }}
                      className="game-btn-primary min-h-[2.75rem] px-4 py-2.5 text-sm disabled:opacity-40"
                    >
                      Envoyer le message
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setFollowUpOpen(false);
                        setFollowUpEvidencePaths([]);
                      }}
                      className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                    >
                      Fermer sans envoyer
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={pending || !m.dispute}
                onClick={() => run(() => matchResetAfterDispute(matchId))}
                className="game-btn-ghost w-full min-h-[3rem] border-amber-500/40 px-5 py-3 text-amber-100 disabled:opacity-40 sm:w-auto sm:min-h-0"
              >
                <span>Réinitialiser la saisie après litige</span>
              </button>
            </div>
          ) : null}

          <div
            className={
              inDispute
                ? "mt-6 space-y-6 rounded-xl border border-amber-500/30 bg-zinc-950/40 px-4 py-5 sm:px-6 sm:py-6"
                : undefined
            }
          >
            {inDispute ? (
              <div className="border-b border-white/10 pb-5">
                <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-amber-200/95">
                  Modifier le résultat
                </p>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-zinc-300 sm:text-[0.95rem]">
                  Corrige ta déclaration si besoin. Dès que les deux joueurs
                  indiquent le même score, le litige se ferme et vous pourrez
                  clôturer le match.
                </p>
              </div>
            ) : null}

            <>
              <div
                className={
                  inDispute
                    ? "flex flex-col gap-5 md:flex-row md:items-end md:gap-6"
                    : "mt-6 flex flex-col gap-5 md:flex-row md:items-end md:gap-6"
                }
              >
                <label className="flex min-w-0 flex-1 flex-col gap-2.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-zinc-500 sm:tracking-[0.22em]">
                  Résultat (ta perspective)
                  <div className="match-arena-select-wrap relative">
                    <select
                      value={outcomeIdx}
                      disabled={scoreLocked || pending}
                      onChange={(e) =>
                        setOutcomeIdx(Number.parseInt(e.target.value, 10))
                      }
                      className="match-arena-select w-full cursor-pointer rounded-[10px] px-4 py-3.5 pr-11 text-left text-base font-medium text-zinc-100 disabled:cursor-not-allowed disabled:opacity-55"
                      aria-label="Résultat du match au format BO3"
                    >
                      <optgroup label="Tes victoires">
                        {outcomeGroups.wins.map((i) => (
                          <option key={i} value={i}>
                            {perspectiveOutcomeLabel(isA, BO3_OUTCOMES[i])}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Victoires de l'adversaire">
                        {outcomeGroups.losses.map((i) => (
                          <option key={i} value={i}>
                            {perspectiveOutcomeLabel(isA, BO3_OUTCOMES[i])}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </label>
                <button
                  type="button"
                  disabled={scoreLocked || pending}
                  onClick={() => {
                    const { mapsWonA, mapsWonB } = globalFromSelection();
                    return run(() =>
                      matchSubmitScoreClaim(matchId, mapsWonA, mapsWonB),
                    );
                  }}
                  className="game-btn-primary w-full min-h-[3rem] shrink-0 px-5 py-3.5 disabled:opacity-40 md:w-auto md:min-w-[220px]"
                >
                  <span className="text-center text-[0.95rem] sm:text-base">
                    {scoreLocked
                      ? "Score verrouillé (accord)"
                      : hasMyClaim
                        ? "Mettre à jour ma déclaration"
                        : "Déclarer et envoyer mon score"}
                  </span>
                </button>
              </div>

              {scoreLocked ? (
                <p className="mt-4 max-w-prose text-sm leading-relaxed text-emerald-200/90 sm:text-[0.95rem]">
                  Les deux joueurs ont déclaré le même résultat — la saisie est
                  figée. Tu peux passer à l&apos;étape 3 pour enregistrer le
                  match.
                </p>
              ) : null}

              {inDispute && claimsMatch(m) ? (
                <p className="mt-4 max-w-prose text-sm leading-relaxed text-emerald-200/90 sm:text-[0.95rem]">
                  Les deux déclarations concordent — le litige devrait se lever
                  automatiquement. Passe à l&apos;étape 3 pour clôturer le
                  match.
                </p>
              ) : null}

              {!inDispute ? (
                <div className="mt-6 rounded-xl border border-red-500/25 bg-red-950/10 px-4 py-4 sm:px-5 sm:py-5">
                  <p className="font-mono text-[0.6rem] uppercase tracking-wider text-red-300/90">
                    Litige / signalement modération
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    Ouvre un ticket pour que l&apos;équipe voie la situation —{" "}
                    <strong className="font-medium text-zinc-200">
                      même si aucun score n&apos;a été déclaré
                    </strong>{" "}
                    (déconnexion, triche, bug, désaccord futur…). Ajoute captures
                    ou une vidéo du combat si tu l&apos;as.
                  </p>
                  {!disputeFlowOpen ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setDisputeFlowOpen(true)}
                      className="mt-4 min-h-[3rem] w-full rounded-xl border border-red-500/50 bg-red-950/40 px-5 py-3 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/15 sm:text-[0.95rem]"
                    >
                      Ouvrir un litige (ticket modération)
                    </button>
                  ) : (
                    <MatchDisputeOpenForm
                      variant={hasOppClaim ? "disagreement" : "early"}
                      myClaimA={claimInt(myClaimA)}
                      myClaimB={claimInt(myClaimB)}
                      oppClaimA={claimInt(oppClaimA)}
                      oppClaimB={claimInt(oppClaimB)}
                      draft={disputeDraft}
                      onDraftChange={setDisputeDraft}
                      evidencePaths={disputeEvidencePaths}
                      setEvidencePaths={setDisputeEvidencePaths}
                      pending={pending}
                      evidenceBusy={evidenceBusy}
                      onPickFiles={appendEvidenceFiles}
                      onSubmit={() =>
                        run(() =>
                          matchSubmitDisputeTicket(
                            matchId,
                            disputeDraft.trim(),
                            disputeEvidencePaths,
                          ),
                        )
                      }
                      onCancel={() => {
                        setDisputeFlowOpen(false);
                        setDisputeEvidencePaths([]);
                        setDisputeDraft("");
                      }}
                    />
                  )}
                </div>
              ) : null}

              {hasOppClaim ? (
                <div
                  className={
                    inDispute
                      ? "rounded-xl border border-white/12 bg-zinc-950/70 px-4 py-5 sm:px-6 sm:py-6"
                      : "mt-8 rounded-xl border border-white/12 bg-zinc-950/70 px-4 py-5 sm:px-6 sm:py-6"
                  }
                >
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-zinc-500 sm:text-[0.65rem]">
                    Déclaration de l&apos;adversaire (lecture seule)
                  </p>
                  <p className="game-title mt-3 text-4xl tabular-nums text-white sm:text-5xl">
                    {oppClaimA} — {oppClaimB}
                  </p>
                  <p className="mt-2 font-mono text-[0.7rem] text-zinc-500 sm:text-xs">
                    Perspective globale · joueur A — joueur B
                  </p>
                  {!inDispute && !claimsMatch(m) ? (
                    <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                      Les scores ne concordent pas — utilise « Ouvrir un litige »
                      ci-dessus pour alerter la modération.
                    </p>
                  ) : null}
                </div>
              ) : hasMyClaim ? (
                <div
                  className="mt-6 flex flex-col items-center justify-center gap-4 rounded-xl border border-amber-500/35 bg-gradient-to-b from-amber-500/[0.07] to-zinc-950/55 px-5 py-8 sm:px-8 sm:py-10"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <span
                    className="inline-block h-9 w-9 shrink-0 animate-spin rounded-full border-2 border-amber-400/25 border-t-amber-400"
                    aria-hidden
                  />
                  <p className="max-w-md text-center font-mono text-sm text-zinc-200 sm:text-base">
                    En attente de la déclaration adverse…
                  </p>
                  <p className="max-w-md text-center text-xs leading-relaxed text-zinc-500 sm:text-sm">
                    Ta déclaration est enregistrée. Dès que l&apos;autre joueur
                    envoie la sienne, le score s&apos;affichera ici.
                  </p>
                </div>
              ) : (
                <p className="mt-6 rounded-lg border border-dashed border-zinc-700/80 bg-zinc-950/40 px-4 py-4 text-center font-mono text-xs text-zinc-500 sm:text-sm">
                  En attente de la déclaration de l&apos;adversaire…
                </p>
              )}

              {hasOppClaim && !hasMyClaim ? (
                <div
                  className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/[0.12] px-4 py-3.5 text-sm leading-relaxed text-amber-100/95 sm:px-5"
                  role="status"
                >
                  <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-amber-200/90">
                    Action requise
                  </p>
                  <p className="mt-2 text-amber-50/95">
                    L&apos;adversaire a déjà déclaré — envoie{" "}
                    <strong className="font-semibold text-white">
                      ta déclaration
                    </strong>{" "}
                    avec « Déclarer et envoyer mon score » (le même résultat
                    qu&apos;indiqué ci-dessus) pour pouvoir clôturer le match.
                  </p>
                </div>
              ) : null}

              {canFinalizeMatch(m) ? (
                <div className="mt-5 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.08] px-4 py-3.5 text-sm text-emerald-100/95 sm:px-5">
                  <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-300/95">
                    Prêt à clôturer
                  </p>
                  <p className="mt-1.5 leading-relaxed">
                    Passe à l&apos;{" "}
                    <strong className="text-white">étape 3</strong> et clique sur
                    « Terminer et enregistrer le match ».
                  </p>
                </div>
              ) : null}

              <div className="mt-8 border-t border-white/10 pt-6">
                <p className="mb-3 font-mono text-[0.6rem] uppercase tracking-wider text-zinc-600">
                  Suivi des déclarations
                </p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  <SummaryChip
                    label="Ta déclaration"
                    value={
                      hasMyClaim
                        ? `${myClaimA} — ${myClaimB}`
                        : "Pas encore envoyée"
                    }
                    highlight={hasMyClaim}
                  />
                  <SummaryChip
                    label="Déclaration adverse"
                    value={
                      hasOppClaim
                        ? `${oppClaimA} — ${oppClaimB}`
                        : "En attente"
                    }
                    highlight={hasOppClaim}
                  />
                </ul>
              </div>
            </>
          </div>
        </section>
      ) : null}

      {/* 3. Clôture */}
      {bothStarted && !confirmed ? (
        <section
          id="etape-cloture"
          className="scroll-mt-6 rounded-2xl border border-white/12 bg-gradient-to-b from-zinc-950/80 to-zinc-950/40 px-4 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-7 sm:py-8 lg:px-8"
        >
          <div className="border-l-2 border-amber-500/35 pl-3 sm:pl-4">
            <h2 className="match-arena-step-title font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-amber-500/90 sm:text-[0.7rem]">
              <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-amber-500/35 bg-amber-500/10 px-1.5 text-[0.6rem] text-amber-200">
                3
              </span>
              <span>Clôturer le match</span>
            </h2>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-zinc-500 sm:text-[0.95rem]">
              Quand les deux déclarations concordent (étape 2), ce bouton enregistre
              le résultat. Les deux joueurs peuvent cliquer — une seule clôture
              suffit.
            </p>
          </div>
          <button
            type="button"
            disabled={pending || finalizeDisabled}
            onClick={() => run(() => matchFinalize(matchId))}
            className={`game-btn-primary mt-6 w-full min-h-[3.25rem] px-6 py-4 font-[family-name:var(--font-bebas)] text-lg tracking-wide sm:max-w-xl sm:text-xl ${
              finalizeDisabled ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <span>Terminer et enregistrer le match</span>
          </button>
          {finalizeDisabled && finalizeHintsList.length > 0 ? (
            <div className="mt-5 rounded-xl border border-zinc-700/80 bg-zinc-950/50 px-4 py-4 sm:px-5">
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-zinc-500">
                Pour débloquer le bouton
              </p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-400">
                {finalizeHintsList.map((line, i) => (
                  <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {!confirmed &&
      (m.status === "pending" || m.status === "disputed") ? (
        <MatchCancellationRequest
          matchId={matchId}
          userId={userId}
          initialRequests={initialCancellationRequests}
        />
      ) : null}

      {!confirmed ? (
        <MatchOpponentChatWidget
          userId={userId}
          inDispute={inDispute}
          messages={chatMessages}
          draft={chatDraft}
          onDraftChange={setChatDraft}
          pending={pending}
          onSend={(text) =>
            new Promise((resolve) => {
              setErr(null);
              startTransition(() => {
                void (async () => {
                  const res = await postDisputeChatMessage(matchId, text);
                  if (res && "error" in res && res.error) {
                    setErr(res.error);
                    resolve({ error: res.error });
                    return;
                  }
                  await refreshDisputeThreads();
                  router.refresh();
                  resolve(undefined);
                })();
              });
            })
          }
        />
      ) : null}

      {confirmed ? (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-4 text-center text-sm leading-relaxed text-emerald-400/95 sm:px-6">
          Le résultat est enregistré. Retourne à{" "}
          <Link
            href="/play/recherche#rencontres-en-cours"
            className="font-medium text-emerald-300 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-200"
          >
            la recherche (liste des rencontres)
          </Link>
          , au{" "}
          <Link
            href="/play"
            className="font-medium text-emerald-300 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-200"
          >
            QG
          </Link>{" "}
          ou lance une{" "}
          <Link
            href="/play/recherche"
            className="font-medium text-emerald-300 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-200"
          >
            nouvelle recherche
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight: boolean;
}) {
  return (
    <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="font-mono text-[0.55rem] uppercase leading-snug tracking-wider text-zinc-600 sm:text-[0.6rem]">
        {label}
      </p>
      <p
        className={`mt-1.5 break-words font-mono text-sm font-medium leading-snug sm:text-[0.95rem] ${
          highlight ? "text-amber-100/95" : "text-zinc-500"
        }`}
      >
        {value}
      </p>
    </li>
  );
}

function PlayerCard({
  label,
  roblox,
  subtitle,
  highlight,
  started,
  ranked,
  matchClosed,
  closedEloDelta,
}: {
  label: string;
  roblox: string;
  subtitle: string;
  highlight: boolean;
  started: boolean;
  ranked: RankedStatsPublic | null;
  matchClosed: boolean;
  closedEloDelta: number | null;
}) {
  const classed =
    ranked != null && isPlacementComplete(ranked.placement_matches_played);
  return (
    <div
      className={`flex h-full w-full min-h-0 flex-col justify-between rounded-xl border p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-2xl sm:p-4 lg:p-6 ${
        highlight
          ? "border-amber-400/55 bg-gradient-to-b from-amber-500/20 via-amber-950/25 to-zinc-950/95 ring-1 ring-amber-400/25 shadow-[0_0_36px_rgba(245,158,11,0.12)]"
          : "border-zinc-700/80 bg-gradient-to-b from-zinc-900/40 to-zinc-950/90"
      }`}
    >
      <div className="min-w-0">
        <p className="font-mono text-[0.45rem] uppercase tracking-[0.2em] text-zinc-500 sm:text-[0.55rem] sm:tracking-[0.28em] md:tracking-[0.3em]">
          {subtitle}
        </p>
        <p className="game-title mt-1 break-words font-[family-name:var(--font-bebas)] text-xl leading-none tracking-wide text-white sm:mt-2 sm:text-3xl md:text-4xl lg:text-[2.5rem]">
          {label}
        </p>
        <p className="mt-2 break-all font-mono text-[0.65rem] leading-snug sm:mt-3 sm:text-xs md:text-sm">
          <span className="text-zinc-500">Roblox</span>
          <span className="mx-1 text-zinc-600 sm:mx-1.5">·</span>
          <span className="font-medium text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.15)]">
            {roblox}
          </span>
        </p>
      </div>
      <div className="mt-3 border-t border-white/10 pt-2 sm:mt-4 sm:pt-3">
        <p className="font-mono text-[0.5rem] uppercase tracking-wider text-zinc-600 sm:text-[0.6rem]">
          ELO
        </p>
        <p
          className={`mt-1 font-mono text-xs sm:mt-1.5 sm:text-sm md:text-[0.95rem] ${
            classed
              ? "font-semibold tabular-nums text-amber-300/95 drop-shadow-[0_0_8px_rgba(251,191,36,0.12)]"
              : "text-zinc-500"
          }`}
        >
          {classed && ranked ? ranked.elo : "Non classé"}
        </p>
      </div>
      {matchClosed ? (
        <div className="mt-3 border-t border-white/10 pt-2 sm:mt-4 sm:pt-3">
          <p className="font-mono text-[0.5rem] uppercase tracking-wider text-zinc-600 sm:text-[0.6rem]">
            Ce match
          </p>
          {closedEloDelta != null ? (
            <p
              className={`mt-1 font-mono text-xs font-semibold tabular-nums sm:mt-1.5 sm:text-sm ${
                closedEloDelta > 0
                  ? "text-emerald-400/95"
                  : closedEloDelta < 0
                    ? "text-rose-300/95"
                    : "text-zinc-400"
              }`}
            >
              {closedEloDelta >= 0 ? "+" : ""}
              {closedEloDelta} ELO
            </p>
          ) : (
            <p className="mt-1 font-mono text-[0.55rem] leading-snug text-zinc-600 sm:text-[0.6rem]">
              Variation non enregistrée
            </p>
          )}
        </div>
      ) : null}
      <div className="mt-3 border-t border-white/10 pt-2 sm:mt-4 sm:pt-4 md:mt-5">
        <p className="font-mono text-[0.5rem] uppercase tracking-wider text-zinc-600 sm:text-[0.6rem]">
          Début confirmé
        </p>
        <p
          className={`mt-1 font-mono text-xs sm:mt-1.5 sm:text-sm md:text-[0.95rem] ${started ? "font-semibold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.25)]" : "text-zinc-500"}`}
        >
          {started ? "Oui" : "Non"}
        </p>
      </div>
    </div>
  );
}
