export function matchStatusLabel(status: string, dispute?: boolean): string {
  if (status === "confirmed") return "Terminé";
  if (status === "cancelled") return "Annulé";
  if (status === "disputed" || dispute) return "Litige";
  if (status === "pending") return "En cours";
  return status;
}

export function matchStatusClass(status: string, dispute?: boolean): string {
  if (status === "confirmed") return "bg-emerald-500/15 text-emerald-300";
  if (status === "cancelled") return "bg-zinc-500/15 text-zinc-400";
  if (status === "disputed" || dispute) return "bg-amber-500/15 text-amber-200";
  return "bg-sky-500/15 text-sky-200";
}

export function formatScore(
  a: number | null,
  b: number | null,
  ba: number | null,
  bb: number | null,
): string {
  if (a == null || b == null) return "—";
  if (ba != null && bb != null && (a !== ba || b !== bb)) {
    return `${a}-${b} / ${ba}-${bb} (conflit)`;
  }
  return `${a}-${b}`;
}
