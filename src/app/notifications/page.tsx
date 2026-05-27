import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { ContentCard } from "@/components/content-card";
import { NotificationsList } from "@/components/notifications-list";
import { PageShell } from "@/components/page-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserNotifications } from "@/lib/notifications-inapp/service";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/notifications");

  const rows = await listUserNotifications(user.id, 80);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl">
        <BackLink />
        <h1 className="mt-6 font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white">
          NOTIFICATIONS
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Alertes de matchs, litiges et messages de modération.
        </p>

        <ContentCard className="mt-8">
          <NotificationsList initialRows={rows} />
        </ContentCard>
      </div>
    </PageShell>
  );
}
