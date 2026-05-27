import { getCurrentUser } from "@/lib/auth/session";
import { NotificationsBrowser } from "@/components/notifications-browser";

export async function NotificationsBrowserSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <NotificationsBrowser />;
}
