import { randomUUID } from "crypto";

/** Caractères de contrôle dangereux (log injection, binaires, etc.) — sauf \n \r \t. */
const CTRL_EXCEPT_NEWLINE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Texte joueur pour ticket : NFC, sans contrôles, longueur bornée (aligné RPC). */
export function sanitizeDisputeExplanation(input: string, maxLen = 2000): string {
  let s = input.normalize("NFC").replace(CTRL_EXCEPT_NEWLINE, "");
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s.trim();
}

/** Messages du chat litige (1–2000 car., même filtrage que les tickets). */
export function sanitizeDisputeChatMessage(input: string, maxLen = 2000): string {
  let s = input.normalize("NFC").replace(CTRL_EXCEPT_NEWLINE, "");
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s.trim();
}

const FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

export function validateDisputeStoragePaths(
  matchId: string,
  userId: string,
  paths: string[],
): boolean {
  if (paths.length > 5) return false;
  for (const p of paths) {
    const segs = p.split("/");
    if (segs.length !== 4) return false;
    if (segs[0] !== "dispute" || segs[1] !== matchId || segs[2] !== userId) return false;
    if (!FILENAME_RE.test(segs[3])) return false;
  }
  return true;
}

export type DetectedImage = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

export function detectImageFromBuffer(buf: Buffer): DetectedImage | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export const DISPUTE_EVIDENCE_MAX_BYTES = 2_621_440; /* 2,5 Mo — aligné bucket */

export function buildDisputeEvidencePath(
  matchId: string,
  userId: string,
  ext: DetectedImage["ext"],
): string {
  return `dispute/${matchId}/${userId}/${randomUUID()}.${ext}`;
}
