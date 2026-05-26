/** URL publique d’un objet du bucket `dispute-evidence` (côté client ou serveur). */
export function publicDisputeEvidenceUrl(objectPath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const enc = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/dispute-evidence/${enc}`;
}
