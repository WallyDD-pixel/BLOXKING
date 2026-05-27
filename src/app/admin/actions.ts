"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { rpcJson } from "@/lib/db/rpc";
import { sanitizeDisputeChatMessage } from "@/lib/dispute-evidence";

function rpcPayload(raw: Record<string, unknown>) {
  return raw;
}

async function callAdminRpc(
  adminId: string,
  sql: string,
  params: unknown[],
): Promise<Record<string, unknown>> {
  const row = await rpcJson<{ result: unknown }>(adminId, sql, params);
  const raw = row?.result;
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, unknown>;
}

function revalidateAdmin(matchId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/matchs");
  revalidatePath("/admin/litiges");
  revalidatePath("/admin/utilisateurs");
  if (matchId) revalidatePath(`/admin/litiges/${matchId}`);
}

export async function adminResolveMatch(
  matchId: string,
  mapsA: number,
  mapsB: number,
): Promise<{ ok?: true; error?: string }> {
  const admin = await requireAdmin();
  const ma = Math.floor(mapsA);
  const mb = Math.floor(mapsB);

  try {
    const p = rpcPayload(
      await callAdminRpc(
        admin.id,
        `select admin_resolve_match($1::uuid, $2::int, $3::int) as result`,
        [matchId, ma, mb],
      ),
    );
    if (p.error) {
      const code = String(p.error);
      if (code === "invalid_bo3_score") {
        return { error: "Score BO3 invalide (ex. 2-0, 2-1)." };
      }
      return { error: "Impossible de clôturer ce match." };
    }
    revalidateAdmin(matchId);
    revalidatePath(`/play/match/${matchId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/forbidden|not_authenticated/i.test(msg)) {
      return { error: "Droits admin requis (db/03_admin.sql + is_admin)." };
    }
    return { error: msg };
  }
}

export async function adminCancelMatch(
  matchId: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = await requireAdmin();
  try {
    const p = rpcPayload(
      await callAdminRpc(
        admin.id,
        `select admin_cancel_match($1::uuid) as result`,
        [matchId],
      ),
    );
    if (p.error) return { error: "Impossible d’annuler ce match." };
    revalidateAdmin(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function adminResetDispute(
  matchId: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = await requireAdmin();
  try {
    const p = rpcPayload(
      await callAdminRpc(
        admin.id,
        `select admin_reset_match_dispute($1::uuid) as result`,
        [matchId],
      ),
    );
    if (p.error) return { error: "Impossible de réinitialiser le litige." };
    revalidateAdmin(matchId);
    revalidatePath(`/play/match/${matchId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function adminPostDisputeChatMessage(
  matchId: string,
  body: string,
): Promise<{ ok?: true; error?: string }> {
  const admin = await requireAdmin();
  const clean = sanitizeDisputeChatMessage(body);
  if (clean.length < 1) return { error: "Message vide." };

  try {
    const p = rpcPayload(
      await callAdminRpc(
        admin.id,
        `select admin_post_dispute_chat_message($1::uuid, $2::text) as result`,
        [matchId, clean],
      ),
    );
    if (p.error) {
      const code = String(p.error);
      if (code === "chat_body_too_short") return { error: "Message trop court." };
      if (code === "chat_body_too_long") return { error: "Message trop long (2000 max)." };
      return { error: "Impossible d’envoyer le message." };
    }
    revalidateAdmin(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur" };
  }
}
