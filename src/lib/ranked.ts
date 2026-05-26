/** Parties de placement avant ELO « stabilisé » (K réduit après). */
export const PLACEMENT_TOTAL = 5;

export const DEFAULT_ELO = 1000;

export type PlayerRankedStatsRow = {
  elo: number;
  placement_matches_played: number;
};

/** Stats ranked exposées côté UI (ex. fiche match). */
export type RankedStatsPublic = {
  elo: number;
  placement_matches_played: number;
};

export function isPlacementComplete(placementMatchesPlayed: number): boolean {
  return placementMatchesPlayed >= PLACEMENT_TOTAL;
}
