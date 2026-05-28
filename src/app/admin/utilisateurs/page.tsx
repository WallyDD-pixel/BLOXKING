import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { countAdminUsers, listAdminUsers } from "@/lib/admin/queries";
import { requireFullAdmin } from "@/lib/auth/admin";

const DEFAULT_LIST_LIMIT = 200;

export default async function AdminUsersPage() {
  await requireFullAdmin();
  const [rows, totalUsers] = await Promise.all([
    listAdminUsers(DEFAULT_LIST_LIMIT),
    countAdminUsers(),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Coche <strong className="text-zinc-300">Mod. litiges</strong> pour donner
        accès au panneau admin (vue d’ensemble, matchs, litiges) sans la page
        utilisateurs ni le PvP.
      </p>
      <AdminUsersTable
        initialRows={rows}
        totalUsers={totalUsers}
        defaultListLimit={DEFAULT_LIST_LIMIT}
      />
    </div>
  );
}
