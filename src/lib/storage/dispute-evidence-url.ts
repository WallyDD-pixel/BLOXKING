/** URL publique d’une preuve (servie par /api/dispute-evidence/...). */
export function disputeEvidencePublicUrl(objectPath: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const enc = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${base}/api/dispute-evidence/${enc}`;
}
