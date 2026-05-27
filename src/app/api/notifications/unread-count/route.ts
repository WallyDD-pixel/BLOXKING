import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getUnreadNotificationsCount } from "@/lib/notifications-inapp/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const count = await getUnreadNotificationsCount(user.id);
  return NextResponse.json({ count });
}
