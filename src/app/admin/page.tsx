import Link from "next/link";
import { AdminOnlineUsers } from "@/components/admin/admin-online-users";
import { AdminPvpToggle } from "@/components/admin/admin-pvp-toggle";
import { AdminSmtpTest } from "@/components/admin/admin-smtp-test";
import { getAdminStats } from "@/lib/admin/queries";
import { requireAdminPanel } from "@/lib/auth/admin";
import { getPvpOperationalState } from "@/lib/site/pvp";

function StatCard({
  label,
  value,
  href,
  tone = "zinc",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "zinc" | "amber" | "emerald";
}) {
  const ring =
    tone === "amber"
      ? "ring-amber-500/30"
      : tone === "emerald"
        ? "ring-emerald-500/30"
        : "ring-white/10";

  return (
    <Link
      href={href}
      className={`rounded-xl border border-white/10 bg-zinc-900/40 p-5 ring-1 ${ring} transition hover:bg-zinc-900/70`}
    >
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-bebas)] text-4xl text-zinc-100">
        {value.toLocaleString("fr-FR")}
      </p>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const access = await requireAdminPanel();
  const [stats, pvpState] = await Promise.all([
    getAdminStats(),
    access.isFullAdmin ? getPvpOperationalState() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-8">
      {access.isDisputeModerator ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Tu es connecté en tant que{" "}
          <strong className="text-white">modérateur litiges</strong> : accès à
          la vue d’ensemble, aux matchs et aux litiges uniquement.
        </p>
      ) : null}

      {access.isFullAdmin && pvpState ? (
        <AdminPvpToggle
          initialEnabled={pvpState.pvpEnabled}
          updatedAt={pvpState.updatedAt}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Utilisateurs"
          value={stats.users_total}
          href="/admin/utilisateurs"
        />
        <StatCard
          label={`En ligne (${stats.presence_window_minutes} min)`}
          value={stats.users_online}
          href="/admin#en-ligne"
          tone="emerald"
        />
        <StatCard
          label="Matchs actifs"
          value={stats.matches_active}
          href="/admin/matchs?status=pending"
          tone="amber"
        />
        <StatCard
          label="Litiges ouverts"
          value={stats.matches_disputed}
          href="/admin/litiges"
          tone="amber"
        />
        <StatCard
          label="Matchs terminés"
          value={stats.matches_confirmed}
          href="/admin/matchs?status=confirmed"
          tone="emerald"
        />
        <StatCard
          label="Total matchs"
          value={stats.matches_total}
          href="/admin/matchs?status=all"
        />
      </div>

      <div id="en-ligne">
        <AdminOnlineUsers
          initialCount={stats.users_online}
          initialWindowMinutes={stats.presence_window_minutes}
        />
      </div>

      {access.isFullAdmin ? <AdminSmtpTest /> : null}

      {access.isFullAdmin ? (
        <p className="text-sm text-zinc-500">
          Accès réservé aux comptes admin. Configure{" "}
          <code className="text-zinc-400">ADMIN_EMAILS</code> dans
          l’environnement ou attribue les rôles dans{" "}
          <code className="text-zinc-400">Utilisateurs</code>.
        </p>
      ) : null}
    </div>
  );
}
