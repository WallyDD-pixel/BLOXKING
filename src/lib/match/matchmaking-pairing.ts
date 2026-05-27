import { PLACEMENT_TOTAL } from "@/lib/ranked";
import type { RecentOpponentInfo } from "@/lib/match/recent-opponents";

export type QueueCandidate = {
  user_id: string;
  elo_snapshot: number;
  placement_snapshot: number;
  first_queued_at?: string;
};

/** Fenêtre ELO de base selon le temps d'attente (±50, +25 / 15 s, max ±800). */
export function matchmakingBaseEloSpan(waitSec: number): number {
  const sec = Math.max(0, waitSec);
  return Math.min(800, 50 + Math.floor(sec / 15) * 25);
}

/**
 * Marge ELO supplémentaire tant que le placement n'est pas terminé (ELO encore instable).
 * 0 partie jouée → +225 LP de tolérance, 4/5 → +45.
 */
export function placementEloUncertainty(placementPlayed: number): number {
  const played = Math.min(
    Math.max(0, Math.floor(placementPlayed)),
    PLACEMENT_TOTAL,
  );
  const remaining = PLACEMENT_TOTAL - played;
  return remaining * 45;
}

export function isCrossPlacementTier(myPl: number, oppPl: number): boolean {
  return (myPl >= PLACEMENT_TOTAL) !== (oppPl >= PLACEMENT_TOTAL);
}

/** Écart ELO maximum autorisé entre deux joueurs. */
export function maxAllowedEloGap(
  myPl: number,
  oppPl: number,
  baseSpan: number,
): number {
  return (
    baseSpan +
    placementEloUncertainty(myPl) +
    placementEloUncertainty(oppPl)
  );
}

const REMATCH_PENALTY_PER_GAME = 90;
const REMATCH_LAST_30MIN_EXTRA = 110;
const REMATCH_LAST_2H_EXTRA = 55;
const REMATCH_HARD_BLOCK_MINUTES = 20;

/** Malus ELO pour éviter de retomber sur le même adversaire. */
export function recentOpponentPenalty(
  opponentId: string,
  recent: Map<string, RecentOpponentInfo>,
  waitSec: number,
): number {
  const hit = recent.get(opponentId);
  if (!hit || hit.count <= 0) return 0;

  const minutesAgo =
    hit.lastAtMs > 0 ? (Date.now() - hit.lastAtMs) / 60_000 : 9999;

  let penalty = hit.count * REMATCH_PENALTY_PER_GAME;
  if (minutesAgo < 30) penalty += REMATCH_LAST_30MIN_EXTRA;
  else if (minutesAgo < 120) penalty += REMATCH_LAST_2H_EXTRA;

  /* Plus on attend, plus on assouplit (petite file). */
  const relax = Math.min(1, Math.max(0, waitSec) / 120);
  return Math.round(penalty * (1 - relax * 0.85));
}

/** Évite un rematch récent s'il existe d'autres candidats valides. */
export function shouldHardAvoidRematch(
  opponentId: string,
  recent: Map<string, RecentOpponentInfo>,
  hasOtherValidCandidates: boolean,
): boolean {
  if (!hasOtherValidCandidates) return false;
  const hit = recent.get(opponentId);
  if (!hit) return false;

  const minutesAgo =
    hit.lastAtMs > 0 ? (Date.now() - hit.lastAtMs) / 60_000 : 9999;

  if (minutesAgo < REMATCH_HARD_BLOCK_MINUTES) return true;
  if (hit.count >= 2 && minutesAgo < 180) return true;
  return false;
}

/**
 * Score de jumelage (plus bas = meilleur). null = hors fenêtre ELO.
 */
export function pairingScore(
  myElo: number,
  myPl: number,
  oppElo: number,
  oppPl: number,
  baseSpan: number,
  opponentId: string,
  recent: Map<string, RecentOpponentInfo>,
  waitSec: number,
): number | null {
  const gap = Math.abs(myElo - oppElo);
  const maxGap = maxAllowedEloGap(myPl, oppPl, baseSpan);
  if (gap > maxGap) return null;

  const crossPenalty = isCrossPlacementTier(myPl, oppPl) ? 55 : 0;
  const rematchPenalty = recentOpponentPenalty(
    opponentId,
    recent,
    waitSec,
  );
  return gap + crossPenalty + rematchPenalty;
}

/** Choisit le meilleur adversaire (ELO, diversité, ancienneté file). */
export function pickBestQueuePartner(
  myElo: number,
  myPl: number,
  baseSpan: number,
  candidates: QueueCandidate[],
  recent: Map<string, RecentOpponentInfo>,
  waitSec: number,
): string | null {
  const scored: {
    userId: string;
    score: number;
    queuedAt: number;
  }[] = [];

  for (const row of candidates) {
    const oppId = String(row.user_id);
    const score = pairingScore(
      myElo,
      myPl,
      Number(row.elo_snapshot),
      Number(row.placement_snapshot),
      baseSpan,
      oppId,
      recent,
      waitSec,
    );
    if (score === null) continue;
    scored.push({
      userId: oppId,
      score,
      queuedAt: row.first_queued_at
        ? new Date(row.first_queued_at).getTime()
        : 0,
    });
  }

  if (scored.length === 0) return null;

  const hasAlternatives = scored.length > 1;
  const filtered = scored.filter(
    (s) => !shouldHardAvoidRematch(s.userId, recent, hasAlternatives),
  );
  const pool = filtered.length > 0 ? filtered : scored;

  pool.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.queuedAt - b.queuedAt;
  });

  return pool[0]?.userId ?? null;
}
