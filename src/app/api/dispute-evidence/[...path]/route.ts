import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { dbQueryOne } from "@/lib/db/query";
import { disputeEvidenceAbsolutePath } from "@/lib/storage/dispute-evidence-server";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
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
  if (match.player_a !== user.id && match.player_b !== user.id) {
    return new NextResponse("Interdit", { status: 403 });
  }

  let full: string;
  try {
    full = disputeEvidenceAbsolutePath(objectPath);
  } catch {
    return new NextResponse("Chemin invalide", { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(full);
  } catch {
    return new NextResponse("Fichier introuvable", { status: 404 });
  }

  const ext = segs[3]?.split(".").pop()?.toLowerCase() ?? "";
  const contentType = MIME[ext] ?? "application/octet-stream";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
