import type { AdminDisputeDecisionRow } from "@/lib/admin/queries";
import { formatAdminUserLabel } from "@/lib/admin/user-label";
import { formatDateTimeFr } from "@/lib/format-datetime";

function actionLabel(action: string): string {
  switch (action) {
    case "resolve":
      return "Score validé";
    case "cancel":
      return "Match annulé";
    case "reset_dispute":
      return "Litige réinitialisé";
    default:
      return action;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "confirmed":
      return "Terminé";
    case "cancelled":
      return "Annulé";
    case "disputed":
      return "Litige";
    case "pending":
      return "En cours";
    default:
      return status;
  }
}

type Props = {
  decisions: AdminDisputeDecisionRow[];
};

export function AdminDisputeDecisionHistory({ decisions }: Props) {
  if (decisions.length === 0) {
    return (
      <section className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
        <h2 className="text-lg font-semibold text-zinc-100">
          Historique des décisions
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Aucune action modération enregistrée pour ce match (les prochaines
          décisions apparaîtront ici).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-500/25 bg-zinc-900/50 p-5">
      <h2 className="text-lg font-semibold text-zinc-100">
        Historique des décisions
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Tu peux rouvrir ce litige et modifier le score ou l&apos;annulation via
        les actions ci-dessus — chaque changement est journalisé.
      </p>
      <ul className="mt-4 space-y-3">
        {decisions.map((d) => {
          const adminName = formatAdminUserLabel({
            roblox_username: d.admin_roblox_username,
            display_name: d.admin_display_name,
            email: d.admin_email,
            fallback: "Modération",
          });
          const score =
            d.maps_a != null && d.maps_b != null
              ? ` · ${d.maps_a}-${d.maps_b}`
              : "";

          return (
            <li
              key={d.id}
              className="rounded-lg border border-white/10 bg-black/25 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-zinc-100">
                  {actionLabel(d.action)}
                  {score}
                </p>
                <time className="text-xs text-zinc-500">
                  {formatDateTimeFr(d.created_at)}
                </time>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Par {adminName} · {statusLabel(d.previous_status)} →{" "}
                {statusLabel(d.new_status)}
              </p>
              {d.note ? (
                <p className="mt-2 text-sm text-amber-200/80">{d.note}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
