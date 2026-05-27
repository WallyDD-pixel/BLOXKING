import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  markAllNotificationsRead,
  markNotificationsRead,
} from "@/lib/notifications-inapp/service";

type Body = {
  ids?: string[];
  all?: boolean;
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  if (body.all) {
    await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  await markNotificationsRead(user.id, ids);
  return NextResponse.json({ ok: true });
}
