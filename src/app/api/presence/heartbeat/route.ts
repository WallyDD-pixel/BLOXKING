import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { recordUserPresence } from "@/lib/presence/record";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let path: string | undefined;
  try {
    const body = (await req.json()) as { path?: string };
    path = body.path;
  } catch {
    /* corps vide */
  }

  try {
    await recordUserPresence(user.id, path);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
