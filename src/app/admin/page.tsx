import Link from "next/link";
import { AdminSmtpTest } from "@/components/admin/admin-smtp-test";
import { getAdminStats } from "@/lib/admin/queries";

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
  const stats = await getAdminStats();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Utilisateurs"
          value={stats.users_total}
          href="/admin/utilisateurs"
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
        <StatCard
          label="Défis ouverts"
          value={stats.open_challenges}
          href="/admin/matchs"
        />
      </div>

      <AdminSmtpTest />

      <p className="text-sm text-zinc-500">
        Accès réservé aux comptes admin. Configure{" "}
        <code className="text-zinc-400">ADMIN_EMAILS</code> dans l’environnement
        ou <code className="text-zinc-400">is_admin</code> en base (
        <code className="text-zinc-400">db/03_admin.sql</code>).
      </p>
    </div>
  );
}
