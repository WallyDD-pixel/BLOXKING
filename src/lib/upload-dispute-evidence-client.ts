/** Envoi preuve litige via route API (pas Server Action — fichiers volumineux). */
export async function uploadDisputeEvidenceClient(
  matchId: string,
  file: File,
): Promise<
  | { path: string; kind: "image" | "video" }
  | { error: string }
> {
  const fd = new FormData();
  fd.append("matchId", matchId);
  fd.append("file", file);

  let res: Response;
  try {
    res = await fetch("/api/dispute-evidence/upload", {
      method: "POST",
      body: fd,
      credentials: "same-origin",
    });
  } catch {
    return {
      error:
        "Échec de l’envoi (réseau ou fichier trop lourd). Réessaie avec une vidéo plus courte.",
    };
  }

  let data: { error?: string; path?: string; kind?: "image" | "video" };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { error: "Réponse serveur invalide." };
  }

  if (!res.ok) {
    return { error: data.error ?? `Échec de l’envoi (${res.status}).` };
  }

  if (!data.path || !data.kind) {
    return { error: "Réponse serveur incomplète." };
  }

  return { path: data.path, kind: data.kind };
}
