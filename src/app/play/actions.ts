"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { dbQuery, dbQueryOne } from "@/lib/db/query";
import { rpcJson } from "@/lib/db/rpc";
import {
  sanitizeDisputeChatMessage,
  sanitizeDisputeExplanation,
  validateDisputeStoragePaths,
} from "@/lib/dispute-evidence";
import {
  notifyDisputeChatEmail,
  notifyDisputeTicketEmail,
} from "@/lib/notifications/dispute-notify";
import { notifyMatchResultEmails } from "@/lib/notifications/match-result-notify";
import {
  notifyDisputeOpenedInApp,
  notifyMatchResultInApp,
  notifyOtherPlayerDisputeMessageInApp,
} from "@/lib/notifications-inapp/events";
import { mapMatchRpcError } from "@/lib/match-rpc-errors";
import { enrichMatchLabels } from "@/lib/match/enrich-labels";
import { joinRankedQueue } from "@/lib/match/join-queue";
import { expireStaleMatchesIfNeeded } from "@/lib/match/expire-stale-matches";
import { disputeEvidencePublicUrl } from "@/lib/storage/dispute-evidence-url";
import type { RankedStatsPublic } from "@/lib/ranked";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

function revalidateMatchPaths(matchId: string) {
  revalidatePath(`/play/match/${matchId}`);
  revalidatePath("/play/recherche");
  revalidatePath("/play/mes-rencontres");
}

function dbError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: string }).message);
  }
  return "Erreur base de données. As-tu exécuté db/00_auth.sql et db/01_ranked.sql ?";
}

async function callUserRpc(
  userId: string,
  sql: string,
  params: unknown[],
): Promise<Record<string, unknown>> {
  const row = await rpcJson<{ result: unknown }>(userId, sql, params);
  const raw = row?.result;
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, unknown>;
}

/** Annule les matchs / litiges expirés (RPC idempotentes). */
async function expireStaleMatchesIfNeededAction() {
  await expireStaleMatchesIfNeeded();
}

export type OngoingMatchRow = {
  id: string;
  status: string;
  source: string;
  player_a: string;
  player_b: string;
  player_a_label: string | null;
  player_b_label: string | null;
  created_at: string;
  match_started_a?: boolean | null;
  match_started_b?: boolean | null;
  claim_from_a_maps_a: number | null;
  claim_from_a_maps_b: number | null;
  claim_from_b_maps_a: number | null;
  claim_from_b_maps_b: number | null;
  dispute?: boolean | null;
  elo_delta_a?: number | null;
  elo_delta_b?: number | null;
};

const ONGOING_SELECT = `
  id, status, source, player_a, player_b, player_a_label, player_b_label,
  created_at, match_started_a, match_started_b,
  claim_from_a_maps_a, claim_from_a_maps_b, claim_from_b_maps_a, claim_from_b_maps_b,
  dispute
`;

const MATCH_HISTORY_SELECT = `
  id, status, source, player_a, player_b, player_a_label, player_b_label,
  created_at, claim_from_a_maps_a, claim_from_a_maps_b,
  claim_from_b_maps_a, claim_from_b_maps_b, dispute, elo_delta_a, elo_delta_b
`;

export async function listOngoingMatches(): Promise<{ rows: OngoingMatchRow[] }> {
  const uid = await getUserId();
  if (!uid) return { rows: [] };

  await expireStaleMatchesIfNeededAction();

  try {
    const rows = await dbQuery<OngoingMatchRow>(
      `
      select ${ONGOING_SELECT}
      from public.matches
      where (player_a = $1 or player_b = $1)
        and status in ('pending', 'disputed')
      order by created_at desc
      `,
      [uid],
    );
    return { rows };
  } catch {
    return { rows: [] };
  }
}

export async function listMatchHistory(
  limit = 100,
): Promise<{ rows: OngoingMatchRow[] }> {
  const uid = await getUserId();
  if (!uid) return { rows: [] };

  await expireStaleMatchesIfNeededAction();

  const lim = Math.min(Math.max(limit, 1), 200);
  try {
    const rows = await dbQuery<OngoingMatchRow>(
      `
      select ${MATCH_HISTORY_SELECT}
      from public.matches
      where player_a = $1 or player_b = $1
      order by created_at desc
      limit $2
      `,
      [uid, lim],
    );
    return { rows };
  } catch {
    return { rows: [] };
  }
}

export async function joinQueue() {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté", matched: false };

  try {
    const svc = await joinRankedQueue(uid);
    if ("error" in svc) {
      return { error: svc.error, matched: false };
    }
    if (svc.matched) {
      try {
        await enrichMatchLabels(svc.matchId);
      } catch {
        /* labels optionnels */
      }
      revalidatePath("/play/recherche");
      return {
        ok: true as const,
        matched: true,
        matchId: svc.matchId,
        opponentId: svc.opponentId,
      };
    }
    return { ok: true as const, matched: false };
  } catch (e) {
    return {
      error: dbError(e),
      matched: false,
    };
  }
}

export async function leaveQueue() {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  try {
    await dbQuery(`delete from public.match_queue where user_id = $1`, [uid]);
    return { ok: true as const };
  } catch (e) {
    return { error: dbError(e) };
  }
}

export async function getQueueMatchSince(iso: string): Promise<{
  match: { id: string } | null;
}> {
  const uid = await getUserId();
  if (!uid) return { match: null };

  try {
    const data = await dbQueryOne<{ id: string } & Record<string, unknown>>(
      `
      select *
      from public.matches
      where (player_a = $1 or player_b = $1)
        and source = 'queue'
        and created_at >= $2::timestamptz
      order by created_at desc
      limit 1
      `,
      [uid, iso],
    );
    if (!data) return { match: null };

    try {
      await enrichMatchLabels(String(data.id));
    } catch {
      /* ignore */
    }

    const refreshed = await dbQueryOne<{ id: string } & Record<string, unknown>>(
      `select * from public.matches where id = $1`,
      [data.id],
    );
    return { match: refreshed ?? data };
  } catch {
    return { match: null };
  }
}

export type MatchPlayersRankedSnapshots = {
  rankedA: RankedStatsPublic | null;
  rankedB: RankedStatsPublic | null;
};

export async function getRankedSnapshotsForMatchParticipants(
  playerA: string,
  playerB: string,
): Promise<MatchPlayersRankedSnapshots> {
  try {
    const stats = await dbQuery<{
      user_id: string;
      elo: number;
      placement_matches_played: number;
    }>(
      `
      select user_id, elo, placement_matches_played
      from public.player_ranked_stats
      where user_id = any($1::uuid[])
      `,
      [[playerA, playerB]],
    );
    const map = new Map<string, RankedStatsPublic>();
    for (const row of stats) {
      map.set(row.user_id, {
        elo: Number(row.elo),
        placement_matches_played: Number(row.placement_matches_played),
      });
    }
    return {
      rankedA: map.get(playerA) ?? null,
      rankedB: map.get(playerB) ?? null,
    };
  } catch {
    return { rankedA: null, rankedB: null };
  }
}

export async function getMatchById(matchId: string) {
  const uid = await getUserId();
  if (!uid) {
    return { match: null, rankedA: null, rankedB: null };
  }

  await expireStaleMatchesIfNeededAction();

  try {
    const data = await dbQueryOne<Record<string, unknown>>(
      `select * from public.matches where id = $1`,
      [matchId],
    );
    if (!data) return { match: null, rankedA: null, rankedB: null };
    if (data.player_a !== uid && data.player_b !== uid) {
      return { match: null, rankedA: null, rankedB: null };
    }
    const { rankedA, rankedB } = await getRankedSnapshotsForMatchParticipants(
      String(data.player_a),
      String(data.player_b),
    );
    return { match: data, rankedA, rankedB };
  } catch {
    return { match: null, rankedA: null, rankedB: null };
  }
}

function rpcPayload(data: Record<string, unknown>): { ok?: boolean; error?: string } {
  if (typeof data.error === "string" && data.error.length > 0) return { error: data.error };
  if (data.ok === true) return { ok: true };
  return { ok: true };
}

export async function matchConfirmStarted(matchId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  try {
    const p = rpcPayload(
      await callUserRpc(uid, `select match_confirm_started($1::uuid) as result`, [matchId]),
    );
    if (p.error) return { error: p.error };
    revalidateMatchPaths(matchId);
    return { ok: true as const };
  } catch (e) {
    return { error: dbError(e) };
  }
}

export async function matchSubmitScoreClaim(
  matchId: string,
  mapsWonA: number,
  mapsWonB: number,
) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  try {
    const p = rpcPayload(
      await callUserRpc(
        uid,
        `select match_submit_score_claim($1::uuid, $2::int, $3::int) as result`,
        [matchId, mapsWonA, mapsWonB],
      ),
    );
    if (p.error) return { error: mapMatchRpcError(p.error) };
    revalidateMatchPaths(matchId);
    return { ok: true as const };
  } catch (e) {
    return { error: dbError(e) };
  }
}

export async function matchAcceptOpponentClaim(matchId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  try {
    const p = rpcPayload(
      await callUserRpc(uid, `select match_accept_opponent_claim($1::uuid) as result`, [
        matchId,
      ]),
    );
    if (p.error) return { error: mapMatchRpcError(p.error) };
    revalidateMatchPaths(matchId);
    return { ok: true as const };
  } catch (e) {
    return { error: dbError(e) };
  }
}

export type DisputeTicketRow = {
  id: string;
  opened_by: string;
  body: string;
  created_at: string;
  attachment_paths: string[];
  attachment_urls: string[];
};

export type DisputeChatMessageRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export async function listDisputeChatMessages(
  matchId: string,
): Promise<{ messages: DisputeChatMessageRow[] }> {
  const uid = await getUserId();
  if (!uid) return { messages: [] };

  const row = await dbQueryOne<{ player_a: string; player_b: string }>(
    `select player_a, player_b from public.matches where id = $1`,
    [matchId],
  );
  if (!row || (row.player_a !== uid && row.player_b !== uid)) return { messages: [] };

  try {
    const messages = await dbQuery<DisputeChatMessageRow>(
      `
      select id, author_id, body, created_at
      from public.match_dispute_chat_messages
      where match_id = $1
      order by created_at asc
      `,
      [matchId],
    );
    return { messages };
  } catch {
    return { messages: [] };
  }
}

export async function postDisputeChatMessage(matchId: string, body: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const clean = sanitizeDisputeChatMessage(body);
  if (clean.length < 1) {
    return { error: mapMatchRpcError("chat_body_too_short") };
  }

  try {
    const p = rpcPayload(
      await callUserRpc(
        uid,
        `select match_post_dispute_chat_message($1::uuid, $2::text) as result`,
        [matchId, clean],
      ),
    );
    if (p.error) return { error: mapMatchRpcError(String(p.error)) };
    revalidateMatchPaths(matchId);
    // Best-effort : ne bloque pas l’action utilisateur si le provider mail n’est pas configuré.
    void notifyDisputeChatEmail({
      matchId,
      authorId: uid,
      message: clean,
    }).catch(() => null);
    void notifyOtherPlayerDisputeMessageInApp(matchId, uid).catch(() => null);
    return { ok: true as const };
  } catch (e) {
    return { error: dbError(e) };
  }
}

export async function listDisputeTickets(
  matchId: string,
): Promise<{ tickets: DisputeTicketRow[] }> {
  const uid = await getUserId();
  if (!uid) return { tickets: [] };

  const row = await dbQueryOne<{ player_a: string; player_b: string }>(
    `select player_a, player_b from public.matches where id = $1`,
    [matchId],
  );
  if (!row || (row.player_a !== uid && row.player_b !== uid)) return { tickets: [] };

  try {
    const rows = await dbQuery<{
      id: string;
      opened_by: string;
      body: string;
      created_at: string;
      attachment_paths: string[] | null;
    }>(
      `
      select id, opened_by, body, created_at, attachment_paths
      from public.match_dispute_tickets
      where match_id = $1
      order by created_at asc
      `,
      [matchId],
    );

    return {
      tickets: rows.map((r) => {
        const attachment_paths = r.attachment_paths ?? [];
        return {
          id: r.id,
          opened_by: r.opened_by,
          body: r.body,
          created_at: r.created_at,
          attachment_paths,
          attachment_urls: attachment_paths.map((p) =>
            disputeEvidencePublicUrl(p),
          ),
        };
      }),
    };
  } catch {
    return { tickets: [] };
  }
}

export type MatchCancellationRequestRow = {
  id: string;
  requested_by: string;
  reason: string;
  status: string;
  created_at: string;
  attachment_paths: string[];
  attachment_urls?: string[];
};

export async function listMatchCancellationRequests(
  matchId: string,
): Promise<{ requests: MatchCancellationRequestRow[] }> {
  const uid = await getUserId();
  if (!uid) return { requests: [] };

  const row = await dbQueryOne<{ player_a: string; player_b: string }>(
    `select player_a, player_b from public.matches where id = $1`,
    [matchId],
  );
  if (!row || (row.player_a !== uid && row.player_b !== uid)) return { requests: [] };

  try {
    const rows = await dbQuery<{
      id: string;
      requested_by: string;
      reason: string;
      status: string;
      created_at: string;
      attachment_paths: string[] | null;
    }>(
      `
      select id, requested_by, reason, status, created_at, attachment_paths
      from public.match_cancellation_requests
      where match_id = $1
      order by created_at desc
      `,
      [matchId],
    );
    const requests: MatchCancellationRequestRow[] = rows.map((r) => {
      const attachment_paths = r.attachment_paths ?? [];
      return {
        id: r.id,
        requested_by: r.requested_by,
        reason: r.reason,
        status: r.status,
        created_at: r.created_at,
        attachment_paths,
        attachment_urls: attachment_paths.map((p) =>
          disputeEvidencePublicUrl(p),
        ),
      };
    });
    return { requests };
  } catch {
    return { requests: [] };
  }
}

export async function matchRequestCancellation(
  matchId: string,
  reason: string,
  attachmentPaths: string[] = [],
) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const clean = sanitizeDisputeExplanation(reason);
  if (clean.length < 10) {
    return { error: mapMatchRpcError("cancellation_reason_too_short") };
  }

  if (!validateDisputeStoragePaths(matchId, uid, attachmentPaths)) {
    return { error: mapMatchRpcError("invalid_attachment_paths") };
  }

  try {
    const p = rpcPayload(
      await callUserRpc(
        uid,
        `select match_request_cancellation($1::uuid, $2::text, $3::text[]) as result`,
        [matchId, clean, attachmentPaths],
      ),
    );
    if (p.error) return { error: mapMatchRpcError(String(p.error)) };
    revalidateMatchPaths(matchId);
    revalidatePath("/admin/matchs");
    revalidatePath(`/admin/litiges/${matchId}`);
    return { ok: true as const };
  } catch (e) {
    return { error: dbError(e) };
  }
}

/** @deprecated Préférer uploadDisputeEvidenceClient (route API, fichiers > ~1 Mo). */
export async function uploadMatchDisputeEvidence(matchId: string, file: File) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" as const };

  const { processDisputeEvidenceUpload } = await import(
    "@/lib/dispute-evidence-upload-server"
  );
  const buf = Buffer.from(await file.arrayBuffer());
  const result = await processDisputeEvidenceUpload(matchId, uid, buf);
  if ("error" in result) return { error: result.error };
  return { path: result.path, kind: result.kind };
}

export async function matchSubmitDisputeTicket(
  matchId: string,
  explanation: string,
  attachmentPaths: string[] = [],
) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const clean = sanitizeDisputeExplanation(explanation);
  if (clean.length < 10) {
    return { error: mapMatchRpcError("ticket_body_too_short") };
  }

  if (!validateDisputeStoragePaths(matchId, uid, attachmentPaths)) {
    return { error: mapMatchRpcError("invalid_attachment_paths") };
  }

  try {
    const p = rpcPayload(
      await callUserRpc(
        uid,
        `select match_submit_dispute_ticket($1::uuid, $2::text, $3::text[]) as result`,
        [matchId, clean, attachmentPaths],
      ),
    );
    if (p.error) return { error: mapMatchRpcError(String(p.error)) };
    revalidateMatchPaths(matchId);
    void notifyDisputeTicketEmail({
      matchId,
      authorId: uid,
      explanation: clean,
    }).catch(() => null);
    void notifyDisputeOpenedInApp(matchId, uid).catch(() => null);
    return { ok: true as const };
  } catch (e) {
    return { error: dbError(e) };
  }
}

export async function matchDeclareDispute(matchId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  try {
    const p = rpcPayload(
      await callUserRpc(uid, `select match_declare_dispute($1::uuid) as result`, [matchId]),
    );
    if (p.error) return { error: mapMatchRpcError(String(p.error)) };
    revalidateMatchPaths(matchId);
    return { ok: true as const };
  } catch (e) {
    return { error: dbError(e) };
  }
}

export async function matchResetAfterDispute(matchId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  try {
    const p = rpcPayload(
      await callUserRpc(uid, `select match_reset_after_dispute($1::uuid) as result`, [
        matchId,
      ]),
    );
    if (p.error) return { error: mapMatchRpcError(p.error) };
    revalidateMatchPaths(matchId);
    return { ok: true as const };
  } catch (e) {
    return { error: dbError(e) };
  }
}

export async function matchFinalize(matchId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  try {
    const p = rpcPayload(
      await callUserRpc(uid, `select match_finalize($1::uuid) as result`, [matchId]),
    );
    if (p.error) return { error: mapMatchRpcError(p.error) };
    revalidateMatchPaths(matchId);
    void notifyMatchResultEmails(matchId);
    void notifyMatchResultInApp(matchId).catch(() => null);
    return { ok: true as const };
  } catch (e) {
    return { error: dbError(e) };
  }
}
