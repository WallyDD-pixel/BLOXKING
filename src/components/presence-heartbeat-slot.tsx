import { getCurrentUser } from "@/lib/auth/session";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";

/** Heartbeat présence pour les visiteurs connectés. */
export async function PresenceHeartbeatSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <PresenceHeartbeat />;
}
