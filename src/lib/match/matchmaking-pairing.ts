import { PLACEMENT_TOTAL } from "@/lib/ranked";

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
  return (
    (myPl >= PLACEMENT_TOTAL) !== (oppPl >= PLACEMENT_TOTAL)
  );
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

/**
 * Score de jumelage (plus bas = meilleur). null = hors fenêtre ELO.
 * Priorise l'équilibre ELO ; léger malus placement vs classé.
 */
export function pairingScore(
  myElo: number,
  myPl: number,
  oppElo: number,
  oppPl: number,
  baseSpan: number,
): number | null {
  const gap = Math.abs(myElo - oppElo);
  const maxGap = maxAllowedEloGap(myPl, oppPl, baseSpan);
  if (gap > maxGap) return null;

  const crossPenalty = isCrossPlacementTier(myPl, oppPl) ? 55 : 0;
  return gap + crossPenalty;
}

/** Choisit le meilleur adversaire dans la file (ELO proche, puis ancienneté). */
export function pickBestQueuePartner(
  myElo: number,
  myPl: number,
  baseSpan: number,
  candidates: QueueCandidate[],
): string | null {
  let best: { userId: string; score: number; queuedAt: number } | null = null;

  for (const row of candidates) {
    const score = pairingScore(
      myElo,
      myPl,
      Number(row.elo_snapshot),
      Number(row.placement_snapshot),
      baseSpan,
    );
    if (score === null) continue;

    const queuedAt = row.first_queued_at
      ? new Date(row.first_queued_at).getTime()
      : 0;

    if (
      !best ||
      score < best.score ||
      (score === best.score && queuedAt < best.queuedAt)
    ) {
      best = { userId: String(row.user_id), score, queuedAt };
    }
  }

  return best?.userId ?? null;
}
