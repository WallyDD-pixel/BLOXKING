import "server-only";

import { mkdir, writeFile } from "fs/promises";
import path from "path";

function storageRoot(): string {
  return process.env.DISPUTE_EVIDENCE_DIR ?? "/var/bloxking/dispute-evidence";
}

export async function saveDisputeEvidenceFile(
  objectPath: string,
  buf: Buffer,
): Promise<void> {
  const root = storageRoot();
  const full = path.join(root, objectPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
}

export function disputeEvidenceAbsolutePath(objectPath: string): string {
  const root = storageRoot();
  const full = path.join(root, objectPath);
  const normalized = path.normalize(full);
  if (!normalized.startsWith(path.normalize(root))) {
    throw new Error("Chemin invalide");
  }
  return normalized;
}
