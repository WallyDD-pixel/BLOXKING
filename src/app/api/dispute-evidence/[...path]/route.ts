import { NextResponse } from "next/server";
import { userIsAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { dbQueryOne } from "@/lib/db/query";
import { serveDisputeEvidenceFile } from "@/lib/storage/dispute-evidence-stream";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non autorisé", { status: 401 });

  const { path: parts } = await ctx.params;
  const objectPath = parts.map(decodeURIComponent).join("/");
  const segs = objectPath.split("/");
  if (segs.length !== 4 || segs[0] !== "dispute") {
    return new NextResponse("Chemin invalide", { status: 400 });
  }

  const matchId = segs[1];
  const match = await dbQueryOne<{ player_a: string; player_b: string }>(
    `select player_a, player_b from public.matches where id = $1`,
    [matchId],
  );
  if (!match) return new NextResponse("Introuvable", { status: 404 });
  const isParticipant =
    match.player_a === user.id || match.player_b === user.id;
  if (!isParticipant && !(await userIsAdmin(user))) {
    return new NextResponse("Interdit", { status: 403 });
  }

  try {
    return await serveDisputeEvidenceFile(objectPath, request);
  } catch {
    return new NextResponse("Fichier introuvable", { status: 404 });
  }
}
