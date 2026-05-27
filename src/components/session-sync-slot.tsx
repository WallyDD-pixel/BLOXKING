import { getCurrentUser } from "@/lib/auth/session";
import { SessionSync } from "@/components/session-sync";

/** Présence + notifications : une seule boucle de polling pour les utilisateurs connectés. */
export async function SessionSyncSlot() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <SessionSync />;
}
