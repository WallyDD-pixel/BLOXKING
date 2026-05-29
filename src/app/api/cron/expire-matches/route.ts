import { NextResponse } from "next/server";
import { runMatchExpiryTasks } from "@/lib/match/expire-stale-matches";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  return request.headers.get("x-cron-secret") === secret;
}

/** Vercel Cron : expiration matchs / litiges (décharge les requêtes joueurs). */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await runMatchExpiryTasks();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[cron expire-matches]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
