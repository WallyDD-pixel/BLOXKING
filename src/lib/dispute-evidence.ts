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
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|mp4|webm)$/i;

export const DISPUTE_EVIDENCE_MAX_BYTES = 2_621_440; /* 2,5 Mo — images */

/** Vidéo litige : défaut 50 Mo (configurable serveur). */
export const DISPUTE_VIDEO_MAX_BYTES = 52_428_800;

export const DISPUTE_MAX_ATTACHMENTS = 5;
export const DISPUTE_MAX_VIDEOS_PER_BATCH = 1;

export type EvidenceKind = "image" | "video";

export function evidencePathKind(objectPath: string): EvidenceKind | null {
  const name = objectPath.split("/").pop()?.toLowerCase() ?? "";
  if (/\.(jpe?g|png|webp)$/.test(name)) return "image";
  if (/\.(mp4|webm)$/.test(name)) return "video";
  return null;
}

export function countVideosInPaths(paths: string[]): number {
  return paths.filter((p) => evidencePathKind(p) === "video").length;
}

export function validateDisputeStoragePaths(
  matchId: string,
  userId: string,
  paths: string[],
): boolean {
  if (paths.length > DISPUTE_MAX_ATTACHMENTS) return false;
  if (countVideosInPaths(paths) > DISPUTE_MAX_VIDEOS_PER_BATCH) return false;
  for (const p of paths) {
    const segs = p.split("/");
    if (segs.length !== 4) return false;
    if (segs[0] !== "dispute" || segs[1] !== matchId || segs[2] !== userId) return false;
    if (!FILENAME_RE.test(segs[3])) return false;
  }
  return true;
}

export type DetectedImage = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  ext: "jpg" | "png" | "webp";
  kind: "image";
};

export type DetectedVideo = {
  mime: "video/mp4" | "video/webm";
  ext: "mp4" | "webm";
  kind: "video";
};

export type DetectedEvidence = DetectedImage | DetectedVideo;

export function detectImageFromBuffer(buf: Buffer): DetectedImage | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg", kind: "image" };
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
    return { mime: "image/png", ext: "png", kind: "image" };
  }
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp", kind: "image" };
  }
  return null;
}

/** MP4 (ftyp) ou WebM (EBML) — pas de transcodage côté serveur. */
export function detectVideoFromBuffer(buf: Buffer): DetectedVideo | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { mime: "video/webm", ext: "webm", kind: "video" };
  }
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    return { mime: "video/mp4", ext: "mp4", kind: "video" };
  }
  return null;
}

export function detectEvidenceFromBuffer(buf: Buffer): DetectedEvidence | null {
  return detectImageFromBuffer(buf) ?? detectVideoFromBuffer(buf);
}

export function disputeVideoMaxBytes(): number {
  const raw = process.env.DISPUTE_VIDEO_MAX_BYTES;
  if (!raw) return DISPUTE_VIDEO_MAX_BYTES;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DISPUTE_VIDEO_MAX_BYTES;
}

export function buildDisputeEvidencePath(
  matchId: string,
  userId: string,
  ext: DetectedImage["ext"] | DetectedVideo["ext"],
): string {
  return `dispute/${matchId}/${userId}/${randomUUID()}.${ext}`;
}

export function formatDisputeVideoMaxMb(): string {
  const mb = disputeVideoMaxBytes() / (1024 * 1024);
  return mb % 1 === 0 ? String(mb) : mb.toFixed(1);
}
