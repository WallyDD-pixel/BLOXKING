import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserNotifications } from "@/lib/notifications-inapp/service";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? 30);
  const notifications = await listUserNotifications(user.id, limit);

  return NextResponse.json({ notifications });
}
