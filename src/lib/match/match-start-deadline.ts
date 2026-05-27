/** Les deux joueurs doivent confirmer le début dans ce délai (aligné sur db/04_match_start_timeout.sql). */
export const MATCH_START_DEADLINE_MS = 2 * 60 * 1000;

/** Match pending sans litige → abandon auto (aligné sur db/05_match_abandon_timeout.sql). */
export const MATCH_ABANDON_DEADLINE_MS = 25 * 60 * 1000;

export function matchStartDeadlineMs(createdAtIso: string): number {
  const created = new Date(createdAtIso).getTime();
  if (!Number.isFinite(created)) return Date.now() + MATCH_START_DEADLINE_MS;
  return created + MATCH_START_DEADLINE_MS;
}

export function matchAbandonDeadlineMs(createdAtIso: string): number {
  const created = new Date(createdAtIso).getTime();
  if (!Number.isFinite(created)) return Date.now() + MATCH_ABANDON_DEADLINE_MS;
  return created + MATCH_ABANDON_DEADLINE_MS;
}

export function formatCountdownMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
