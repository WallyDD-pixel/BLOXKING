/** Sync présence + notifications (1 requête au lieu de 3). */
export const SESSION_SYNC_INTERVAL_MS = 30_000;

/** File matchmaking — 3 s suffit pour le jumelage sans surcharger le serveur. */
export const MATCHMAKING_POLL_MS = 3_000;

/** Liste des rencontres en cours (hors match actif). */
export const ONGOING_MATCHES_POLL_MS = 20_000;

/** Rafraîchissement état match (scores, statut). */
export const MATCH_ARENA_REFRESH_MS = 4_000;

/** Fil de litige dans l'arène. */
export const MATCH_DISPUTE_POLL_MS = 6_000;
