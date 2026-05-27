/** Les deux joueurs doivent confirmer le début dans ce délai (aligné sur db/04_match_start_timeout.sql). */
export const MATCH_START_DEADLINE_MS = 5 * 60 * 1000;

export function matchStartDeadlineMs(createdAtIso: string): number {
  const created = new Date(createdAtIso).getTime();
  if (!Number.isFinite(created)) return Date.now() + MATCH_START_DEADLINE_MS;
  return created + MATCH_START_DEADLINE_MS;
}

export function formatCountdownMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
