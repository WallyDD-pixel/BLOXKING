const STORAGE_KEY = "bloxking_mm_search_v1";

export type MatchmakingSearchPersisted = {
  userId: string;
  /** ISO 8601 — moment où la file serveur est confirmée (après join sans match immédiat). */
  since: string;
};

const EVENT = "bloxking-mm-search";

export function dispatchMatchmakingSearchChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function readMatchmakingSearch(): MatchmakingSearchPersisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const userId = (o as { userId?: string }).userId;
    const since = (o as { since?: string }).since;
    if (typeof userId !== "string" || typeof since !== "string") return null;
    const t = Date.parse(since);
    if (!Number.isFinite(t)) return null;
    return { userId, since };
  } catch {
    return null;
  }
}

export function setMatchmakingSearchActive(
  userId: string,
  sinceIso: string,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ userId, since: sinceIso } satisfies MatchmakingSearchPersisted),
    );
    dispatchMatchmakingSearchChanged();
  } catch {
    /* quota / private mode */
  }
}

/** Efface l’indicateur pour cet utilisateur (ou tout si userId omis). */
export function clearMatchmakingSearch(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (userId == null) {
      window.localStorage.removeItem(STORAGE_KEY);
      dispatchMatchmakingSearchChanged();
      return;
    }
    const cur = readMatchmakingSearch();
    if (cur?.userId === userId) {
      window.localStorage.removeItem(STORAGE_KEY);
      dispatchMatchmakingSearchChanged();
    }
  } catch {
    /* ignore */
  }
}

export function matchmakingSearchEventName(): string {
  return EVENT;
}

export function formatSearchDurationFr(elapsedMs: number): string {
  const s = Math.floor(Math.max(0, elapsedMs) / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) {
    return rs > 0 ? `${m} min ${rs} s` : `${m} min`;
  }
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h} h ${rm} min` : `${h} h`;
}
