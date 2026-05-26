import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { processDisputeEvidenceUpload } from "@/lib/dispute-evidence-upload-server";

export const runtime = "nodejs";

/** Upload preuves litige (images + vidéos) — évite la limite ~1 Mo des Server Actions. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide ou trop volumineux." },
      { status: 413 },
    );
  }

  const matchId = form.get("matchId");
  const file = form.get("file");
  if (typeof matchId !== "string" || !matchId) {
    return NextResponse.json({ error: "matchId manquant." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  }

  const ab = await file.arrayBuffer();
  const result = await processDisputeEvidenceUpload(
    matchId,
    user.id,
    Buffer.from(ab),
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ path: result.path, kind: result.kind });
}
