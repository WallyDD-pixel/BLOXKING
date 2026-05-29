import { rpcJsonSystem } from "@/lib/db/rpc";

export {
  MATCH_START_DEADLINE_MS,
  MATCH_ABANDON_DEADLINE_MS,
  formatCountdownMs,
  matchStartDeadlineMs,
  matchAbandonDeadlineMs,
} from "@/lib/match/match-start-deadline";

const EXPIRE_THROTTLE_MS = Number(
  process.env.MATCH_EXPIRE_THROTTLE_MS ?? "45000",
);

declare global {
  // eslint-disable-next-line no-var
  var __bloxking_last_match_expire_ms: number | undefined;
}

/** Exécute les 3 RPC d’expiration (idempotentes). */
export async function runMatchExpiryTasks(): Promise<void> {
  await rpcJsonSystem(
    `select expire_pending_matches_after_start_timeout() as result`,
  );
  await rpcJsonSystem(
    `select expire_pending_matches_after_abandon_timeout() as result`,
  );
  await rpcJsonSystem(
    `select expire_disputed_matches_after_ticket_timeout() as result`,
  );
}

/**
 * Évite de lancer 3 RPC à chaque requête utilisateur (critique sur Vercel).
 * Le cron `/api/cron/expire-matches` peut forcer l’exécution régulière.
 */
export async function expireStaleMatchesIfNeeded(options?: {
  force?: boolean;
}): Promise<void> {
  if (options?.force) {
    globalThis.__bloxking_last_match_expire_ms = Date.now();
    await runMatchExpiryTasks();
    return;
  }

  const throttle =
    Number.isFinite(EXPIRE_THROTTLE_MS) && EXPIRE_THROTTLE_MS > 0
      ? EXPIRE_THROTTLE_MS
      : 45_000;

  const now = Date.now();
  const last = globalThis.__bloxking_last_match_expire_ms ?? 0;
  if (now - last < throttle) return;

  globalThis.__bloxking_last_match_expire_ms = now;
  await runMatchExpiryTasks();
}
