import { NextResponse } from "next/server";
import { userIsAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { getAdminOnlineUsers } from "@/lib/admin/queries";
import { PRESENCE_ONLINE_MINUTES } from "@/lib/presence/constants";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await userIsAdmin(user))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const online = await getAdminOnlineUsers();
  return NextResponse.json({
    count: online.length,
    windowMinutes: PRESENCE_ONLINE_MINUTES,
    users: online,
  });
}
