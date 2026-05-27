import { rpcJsonSystem } from "@/lib/db/rpc";

export {
  MATCH_START_DEADLINE_MS,
  formatCountdownMs,
  matchStartDeadlineMs,
} from "@/lib/match/match-start-deadline";

export async function expireStaleMatchesIfNeeded(): Promise<void> {
  await rpcJsonSystem(
    `select expire_pending_matches_after_start_timeout() as result`,
  );
  await rpcJsonSystem(
    `select expire_disputed_matches_after_ticket_timeout() as result`,
  );
}
