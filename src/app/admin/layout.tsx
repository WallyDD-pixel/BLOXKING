import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageShell } from "@/components/page-shell";
import { requireAdminPanel } from "@/lib/auth/admin";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await requireAdminPanel();

  return (
    <PageShell ads={false}>
      <div className="mx-auto w-full max-w-6xl flex-1">
        <div className="mb-6">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-amber-500/90">
            Administration
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-zinc-100">
            Panneau BloXKING
          </h1>
        </div>
        <AdminNav canManageUsers={access.isFullAdmin} />
        <div className="mt-8">{children}</div>
      </div>
    </PageShell>
  );
}
