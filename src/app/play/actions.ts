"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  buildDisputeEvidencePath,
  detectImageFromBuffer,
  DISPUTE_EVIDENCE_MAX_BYTES,
  sanitizeDisputeChatMessage,
  sanitizeDisputeExplanation,
  validateDisputeStoragePaths,
} from "@/lib/dispute-evidence";
import { mapMatchRpcError } from "@/lib/match-rpc-errors";
import {
  enrichMatchLabels,
  joinRankedQueueViaService,
} from "@/lib/supabase/admin";
import type { RankedStatsPublic } from "@/lib/ranked";

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function revalidateMatchPaths(matchId: string) {
  revalidatePath(`/play/match/${matchId}`);
  revalidatePath("/play/recherche");
  revalidatePath("/play/mes-rencontres");
}

/** Annule les litiges non traités depuis 30 min après le 1er ticket (RPC idempotente). */
async function expireDisputedMatchesIfNeeded() {
  const supabase = await createClient();
  await supabase.rpc("expire_disputed_matches_after_ticket_timeout");
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
  /** LP (ELO) gagnées/perdues pour le joueur A après clôture (null si pas encore traité ou match ancien). */
  elo_delta_a?: number | null;
  elo_delta_b?: number | null;
};

/** Matchs ranked non terminés (pending / disputed) pour le joueur connecté. */
export async function listOngoingMatches(): Promise<{ rows: OngoingMatchRow[] }> {
  const uid = await getUserId();
  if (!uid) return { rows: [] };

  await expireDisputedMatchesIfNeeded();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      [
        "id",
        "status",
        "source",
        "player_a",
        "player_b",
        "player_a_label",
        "player_b_label",
        "created_at",
        "match_started_a",
        "match_started_b",
        "claim_from_a_maps_a",
        "claim_from_a_maps_b",
        "claim_from_b_maps_a",
        "claim_from_b_maps_b",
        "dispute",
      ].join(", "),
    )
    .or(`player_a.eq.${uid},player_b.eq.${uid}`)
    .in("status", ["pending", "disputed"])
    .order("created_at", { ascending: false });

  if (error) return { rows: [] };
  return { rows: (data ?? []) as unknown as OngoingMatchRow[] };
}

const MATCH_HISTORY_SELECT = [
  "id",
  "status",
  "source",
  "player_a",
  "player_b",
  "player_a_label",
  "player_b_label",
  "created_at",
  "claim_from_a_maps_a",
  "claim_from_a_maps_b",
  "claim_from_b_maps_a",
  "claim_from_b_maps_b",
  "dispute",
  "elo_delta_a",
  "elo_delta_b",
].join(", ");

/** Historique des matchs ranked du joueur (tous statuts), du plus récent au plus ancien. */
export async function listMatchHistory(
  limit = 100,
): Promise<{ rows: OngoingMatchRow[] }> {
  const uid = await getUserId();
  if (!uid) return { rows: [] };

  await expireDisputedMatchesIfNeeded();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_HISTORY_SELECT)
    .or(`player_a.eq.${uid},player_b.eq.${uid}`)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) return { rows: [] };
  return { rows: (data ?? []) as unknown as OngoingMatchRow[] };
}

function rpcError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: string }).message);
  }
  return "Erreur Supabase. As-tu exécuté le script SQL dans le dashboard (supabase/migrations) ?";
}

export async function createChallenge() {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const supabase = await createClient();

  const { count: activeCount, error: countErr } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .or(`player_a.eq.${uid},player_b.eq.${uid}`)
    .in("status", ["pending", "disputed"]);

  if (countErr) return { error: rpcError(countErr) };
  if ((activeCount ?? 0) > 0) {
    return {
      error:
        "Tu as déjà une rencontre en cours. Termine-la ou résous le litige avant de publier un défi.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const display =
    (user?.user_metadata as { roblox_username?: string } | undefined)
      ?.roblox_username ?? user?.email?.split("@")[0] ?? "Joueur";

  const { error } = await supabase.from("open_challenges").insert({
    creator_id: uid,
    creator_display_name: display,
    status: "open",
  });

  if (error) return { error: rpcError(error) };
  revalidatePath("/play/defis");
  return { ok: true as const };
}

export async function cancelChallenge(challengeId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("open_challenges")
    .update({ status: "cancelled" })
    .eq("id", challengeId)
    .eq("creator_id", uid)
    .eq("status", "open");

  if (error) return { error: rpcError(error) };
  revalidatePath("/play/defis");
  return { ok: true as const };
}

export async function cancelChallengeForm(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await cancelChallenge(id);
}

export async function acceptChallenge(challengeId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_open_challenge", {
    challenge_uuid: challengeId,
  });

  if (error) return { error: rpcError(error) };
  const payload = data as { ok?: boolean; error?: string; match_id?: string };
  if (payload?.error) return { error: mapMatchRpcError(payload.error) };
  const mid = payload?.match_id;
  if (mid) await enrichMatchLabels(mid);
  revalidatePath("/play/defis");
  revalidatePath("/play/recherche");
  return { ok: true as const, matchId: mid };
}

export async function acceptChallengeForm(formData: FormData) {
  const id = formData.get("challengeId");
  if (typeof id !== "string") return;
  await acceptChallenge(id);
}

export async function createChallengeForm(_formData: FormData) {
  await createChallenge();
}

export async function joinQueue() {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté", matched: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_ranked_queue", {
    queue_ctx: { source: "bloxking" },
  });

  if (!error && data != null) {
    const payload = data as {
      matched?: boolean;
      match_id?: string;
      opponent_id?: string;
      error?: string;
    };
    if (payload?.error)
      return { error: mapMatchRpcError(payload.error), matched: false };

    if (payload?.matched && payload.match_id) {
      try {
        await enrichMatchLabels(payload.match_id);
      } catch {
        /* labels optionnels si la clé service est absente */
      }
      revalidatePath("/play/recherche");
      return {
        ok: true as const,
        matched: true,
        matchId: payload.match_id,
        opponentId: payload.opponent_id,
      };
    }

    return { ok: true as const, matched: false };
  }

  const rpcErrMsg = error != null ? rpcError(error) : "";
  const rpcHint =
    error != null
      ? `${rpcErrMsg}${/function|schema cache/i.test(rpcErrMsg) ? " Exécute supabase/setup_bloxking_ranked.sql dans le SQL Editor Supabase." : ""}`
      : "Réponse RPC vide — exécute supabase/setup_bloxking_ranked.sql dans le SQL Editor Supabase.";

  const svc = await joinRankedQueueViaService(uid);
  if (svc === null) {
    return {
      error: `${rpcHint} Pour un mode secours sans RPC : ajoute SUPABASE_SERVICE_ROLE_KEY dans .env.local (clé secrète du dashboard, jamais côté client).`,
      matched: false,
    };
  }
  if ("error" in svc) {
    const setupHint =
      /table|schema cache|relation|does not exist/i.test(svc.error)
        ? " — Crée d’abord les tables : fichier supabase/setup_bloxking_ranked.sql → tout coller dans Supabase → SQL Editor → Run."
        : "";
    return {
      error: `${rpcHint} Secours DB : ${svc.error}${setupHint}`,
      matched: false,
    };
  }
  if (svc.matched) {
    try {
      await enrichMatchLabels(svc.matchId);
    } catch {
      /* ignore */
    }
    revalidatePath("/play/recherche");
    return {
      ok: true as const,
      matched: true,
      matchId: svc.matchId,
      opponentId: svc.opponentId,
    };
  }

  return { ok: true as const, matched: false, viaServiceFallback: true as const };
}

export async function leaveQueue() {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const supabase = await createClient();
  const { error } = await supabase.from("match_queue").delete().eq("user_id", uid);

  if (error) return { error: rpcError(error) };
  return { ok: true as const };
}

export async function getQueueMatchSince(iso: string) {
  const uid = await getUserId();
  if (!uid) return { match: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .or(`player_a.eq.${uid},player_b.eq.${uid}`)
    .eq("source", "queue")
    .gte("created_at", iso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { match: null };

  try {
    await enrichMatchLabels(data.id);
  } catch {
    /* ignore */
  }

  const { data: refreshed } = await supabase
    .from("matches")
    .select("*")
    .eq("id", data.id)
    .maybeSingle();

  return { match: refreshed ?? data };
}

export type MatchPlayersRankedSnapshots = {
  rankedA: RankedStatsPublic | null;
  rankedB: RankedStatsPublic | null;
};

export async function getRankedSnapshotsForMatchParticipants(
  playerA: string,
  playerB: string,
): Promise<MatchPlayersRankedSnapshots> {
  const supabase = await createClient();
  const { data: stats } = await supabase
    .from("player_ranked_stats")
    .select("user_id, elo, placement_matches_played")
    .in("user_id", [playerA, playerB]);

  const map = new Map<string, RankedStatsPublic>();
  for (const row of stats ?? []) {
    if (row.user_id == null) continue;
    map.set(row.user_id, {
      elo: Number(row.elo),
      placement_matches_played: Number(row.placement_matches_played),
    });
  }
  return {
    rankedA: map.get(playerA) ?? null,
    rankedB: map.get(playerB) ?? null,
  };
}

export async function getMatchById(matchId: string) {
  const uid = await getUserId();
  if (!uid) {
    return { match: null, rankedA: null, rankedB: null };
  }

  await expireDisputedMatchesIfNeeded();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();

  if (error || !data) {
    return { match: null, rankedA: null, rankedB: null };
  }
  if (data.player_a !== uid && data.player_b !== uid) {
    return { match: null, rankedA: null, rankedB: null };
  }

  const { rankedA, rankedB } = await getRankedSnapshotsForMatchParticipants(
    data.player_a,
    data.player_b,
  );
  return { match: data, rankedA, rankedB };
}

function rpcPayload(data: unknown): { ok?: boolean; error?: string } {
  if (!data || typeof data !== "object") return { error: "Réponse invalide" };
  const o = data as Record<string, unknown>;
  if (typeof o.error === "string" && o.error.length > 0) return { error: o.error };
  if (o.ok === true) return { ok: true };
  return { ok: true };
}

export async function matchConfirmStarted(matchId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_confirm_started", {
    p_match_id: matchId,
  });

  if (error) return { error: rpcError(error) };
  const p = rpcPayload(data);
  if (p.error) return { error: p.error };
  revalidateMatchPaths(matchId);
  return { ok: true as const };
}

export async function matchSubmitScoreClaim(
  matchId: string,
  mapsWonA: number,
  mapsWonB: number,
) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_submit_score_claim", {
    p_match_id: matchId,
    p_maps_won_a: mapsWonA,
    p_maps_won_b: mapsWonB,
  });

  if (error) return { error: rpcError(error) };
  const p = rpcPayload(data);
  if (p.error) return { error: mapMatchRpcError(p.error) };
  revalidateMatchPaths(matchId);
  return { ok: true as const };
}

export async function matchAcceptOpponentClaim(matchId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_accept_opponent_claim", {
    p_match_id: matchId,
  });

  if (error) return { error: rpcError(error) };
  const p = rpcPayload(data);
  if (p.error) return { error: mapMatchRpcError(p.error) };
  revalidateMatchPaths(matchId);
  return { ok: true as const };
}

export type DisputeTicketRow = {
  id: string;
  opened_by: string;
  body: string;
  created_at: string;
  attachment_urls: string[];
};

/** Message chat joueur–joueur (dès pending jusqu’à clôture). Côté DB : push_notification_sent_at pour futur envoi push / e-mail. */
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

  const supabase = await createClient();
  const { data: row, error: me } = await supabase
    .from("matches")
    .select("player_a, player_b")
    .eq("id", matchId)
    .maybeSingle();

  if (me || !row) return { messages: [] };
  const m = row as { player_a: string; player_b: string };
  if (m.player_a !== uid && m.player_b !== uid) return { messages: [] };

  const { data, error } = await supabase
    .from("match_dispute_chat_messages")
    .select("id, author_id, body, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (error) return { messages: [] };
  return { messages: (data ?? []) as DisputeChatMessageRow[] };
}

export async function postDisputeChatMessage(matchId: string, body: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const clean = sanitizeDisputeChatMessage(body);
  if (clean.length < 1) {
    return { error: mapMatchRpcError("chat_body_too_short") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_post_dispute_chat_message", {
    p_match_id: matchId,
    p_body: clean,
  });

  if (error) return { error: rpcError(error) };
  const p = rpcPayload(data);
  if (p.error) return { error: mapMatchRpcError(String(p.error)) };
  revalidateMatchPaths(matchId);
  return { ok: true as const };
}

export async function listDisputeTickets(
  matchId: string,
): Promise<{ tickets: DisputeTicketRow[] }> {
  const uid = await getUserId();
  if (!uid) return { tickets: [] };

  const supabase = await createClient();
  const { data: row, error: me } = await supabase
    .from("matches")
    .select("player_a, player_b")
    .eq("id", matchId)
    .maybeSingle();

  if (me || !row) return { tickets: [] };
  const m = row as { player_a: string; player_b: string };
  if (m.player_a !== uid && m.player_b !== uid) return { tickets: [] };

  const { data, error } = await supabase
    .from("match_dispute_tickets")
    .select("id, opened_by, body, created_at, attachment_paths")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (error) return { tickets: [] };

  const rows = (data ?? []) as Array<{
    id: string;
    opened_by: string;
    body: string;
    created_at: string;
    attachment_paths: string[] | null;
  }>;

  return {
    tickets: rows.map((r) => {
      const paths = r.attachment_paths ?? [];
      const attachment_urls = paths.map((p) => {
        const { data: pub } = supabase.storage
          .from("dispute-evidence")
          .getPublicUrl(p);
        return pub.publicUrl;
      });
      return {
        id: r.id,
        opened_by: r.opened_by,
        body: r.body,
        created_at: r.created_at,
        attachment_urls,
      };
    }),
  };
}

/** Upload une image de preuve (JPEG / PNG / WebP, max ~2,5 Mo). Retourne le chemin Storage. */
export async function uploadMatchDisputeEvidence(matchId: string, file: File) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" as const };

  const ab = await file.arrayBuffer();
  if (ab.byteLength > DISPUTE_EVIDENCE_MAX_BYTES) {
    return { error: "Fichier trop volumineux (max. 2,5 Mo)." as const };
  }

  const buf = Buffer.from(ab);
  const kind = detectImageFromBuffer(buf);
  if (!kind) {
    return {
      error: "Format non supporté : envoie une image JPEG, PNG ou WebP." as const,
    };
  }

  const path = buildDisputeEvidencePath(matchId, uid, kind.ext);
  const supabase = await createClient();

  const { error } = await supabase.storage.from("dispute-evidence").upload(path, buf, {
    contentType: kind.mime,
    upsert: false,
  });

  if (error) {
    return { error: "Envoi de l’image refusé — réessaie plus tard." as const };
  }

  return { path };
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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_submit_dispute_ticket", {
    p_match_id: matchId,
    p_explanation: clean,
    p_attachment_paths: attachmentPaths,
  });

  if (error) return { error: rpcError(error) };
  const p = rpcPayload(data);
  if (p.error) return { error: mapMatchRpcError(String(p.error)) };
  revalidateMatchPaths(matchId);
  revalidatePath("/play/defis");
  return { ok: true as const };
}

/** @deprecated Préférer matchSubmitDisputeTicket (ticket obligatoire). */
export async function matchDeclareDispute(matchId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_declare_dispute", {
    p_match_id: matchId,
  });

  if (error) return { error: rpcError(error) };
  const p = rpcPayload(data);
  if (p.error) return { error: mapMatchRpcError(String(p.error)) };
  revalidateMatchPaths(matchId);
  return { ok: true as const };
}

export async function matchResetAfterDispute(matchId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_reset_after_dispute", {
    p_match_id: matchId,
  });

  if (error) return { error: rpcError(error) };
  const p = rpcPayload(data);
  if (p.error) return { error: mapMatchRpcError(p.error) };
  revalidateMatchPaths(matchId);
  return { ok: true as const };
}

export async function matchFinalize(matchId: string) {
  const uid = await getUserId();
  if (!uid) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_finalize", {
    p_match_id: matchId,
  });

  if (error) return { error: rpcError(error) };
  const p = rpcPayload(data);
  if (p.error) return { error: mapMatchRpcError(p.error) };
  revalidateMatchPaths(matchId);
  return { ok: true as const };
}
