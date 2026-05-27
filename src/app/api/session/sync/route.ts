import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getUnreadNotificationsCount,
  listUserNotifications,
} from "@/lib/notifications-inapp/service";
import { recordUserPresence } from "@/lib/presence/record";

/** Présence + compteur + liste notifications en une seule requête authentifiée. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let path = "/";
  try {
    const body = (await req.json()) as { path?: string };
    path = body.path ?? "/";
  } catch {
    /* corps vide */
  }

  try {
    const [, unreadCount, notifications] = await Promise.all([
      recordUserPresence(user.id, path),
      getUnreadNotificationsCount(user.id),
      listUserNotifications(user.id, 10),
    ]);

    return NextResponse.json({ unreadCount, notifications });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
