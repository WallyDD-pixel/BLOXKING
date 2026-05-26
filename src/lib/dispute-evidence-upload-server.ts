import "server-only";

import {
  buildDisputeEvidencePath,
  detectEvidenceFromBuffer,
  DISPUTE_EVIDENCE_MAX_BYTES,
  formatDisputeVideoMaxMb,
  disputeVideoMaxBytes,
} from "@/lib/dispute-evidence";
import { saveDisputeEvidenceFile } from "@/lib/storage/dispute-evidence-server";
import { dbQueryOne } from "@/lib/db/query";

export type DisputeEvidenceUploadResult =
  | { path: string; kind: "image" | "video" }
  | { error: string };

export async function processDisputeEvidenceUpload(
  matchId: string,
  userId: string,
  buf: Buffer,
): Promise<DisputeEvidenceUploadResult> {
  const match = await dbQueryOne<{ player_a: string; player_b: string }>(
    `select player_a, player_b from public.matches where id = $1`,
    [matchId],
  );
  if (!match) return { error: "Match introuvable." };
  if (match.player_a !== userId && match.player_b !== userId) {
    return { error: "Tu n’es pas joueur sur ce match." };
  }

  const detected = detectEvidenceFromBuffer(buf);
  if (!detected) {
    return {
      error:
        "Format non supporté : image (JPEG, PNG, WebP) ou vidéo (MP4, WebM).",
    };
  }

  if (detected.kind === "image") {
    if (buf.byteLength > DISPUTE_EVIDENCE_MAX_BYTES) {
      return { error: "Image trop volumineuse (max. 2,5 Mo)." };
    }
  } else {
    const videoMax = disputeVideoMaxBytes();
    if (buf.byteLength > videoMax) {
      return {
        error: `Vidéo trop volumineuse (max. ${formatDisputeVideoMaxMb()} Mo). Compresse ou raccourcis le clip.`,
      };
    }
  }

  const objectPath = buildDisputeEvidencePath(matchId, userId, detected.ext);
  try {
    await saveDisputeEvidenceFile(objectPath, buf);
  } catch (e) {
    console.error("[dispute-evidence] save failed:", e);
    return {
      error:
        detected.kind === "video"
          ? "Envoi de la vidéo refusé — vérifie DISPUTE_EVIDENCE_DIR sur le serveur."
          : "Envoi de l’image refusé — réessaie plus tard.",
    };
  }

  return { path: objectPath, kind: detected.kind };
}
