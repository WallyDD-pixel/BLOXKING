/** Normalise une requête de recherche (insensible à la casse, espaces). */
export function normalizeSearchQuery(q: string): string {
  return q
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Chaîne indexable pour l’attribut `data-search` des lignes. */
export function searchBlob(
  ...parts: (string | number | boolean | null | undefined)[]
): string {
  return parts
    .filter((p) => p != null && p !== "")
    .map((p) => String(p))
    .join(" ")
    .normalize("NFC")
    .toLowerCase();
}
