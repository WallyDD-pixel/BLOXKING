import type { AdminMatchProgress } from "@/lib/admin/match-progress";

export function AdminMatchProgressBadge({
  progress,
}: {
  progress: AdminMatchProgress;
}) {
  return (
    <div className="space-y-1">
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${progress.phaseClass}`}
      >
        {progress.phaseLabel}
      </span>
      <p className="max-w-[14rem] text-xs leading-snug text-zinc-500">
        {progress.summary}
      </p>
      {progress.startDeadlineNote ? (
        <p className="text-xs font-medium text-amber-500/90">
          {progress.startDeadlineNote}
        </p>
      ) : null}
    </div>
  );
}

export function AdminMatchProgressPanel({
  progress,
}: {
  progress: AdminMatchProgress;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-zinc-950/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Progression du match
          </p>
          <p className="mt-1 text-sm text-zinc-300">{progress.summary}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${progress.phaseClass}`}
        >
          {progress.phaseLabel}
        </span>
      </div>

      {progress.startDeadlineNote ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/95">
          {progress.startDeadlineNote}
        </p>
      ) : null}

      <ol className="mt-4 space-y-2">
        {progress.steps.map((step, i) => (
          <li
            key={step.key}
            className={`flex gap-3 rounded-lg border px-3 py-2.5 text-sm ${
              step.active
                ? "border-amber-500/35 bg-amber-500/8"
                : step.done
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-white/8 bg-white/[0.02]"
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.done
                  ? "bg-emerald-500/20 text-emerald-300"
                  : step.active
                    ? "bg-amber-500/25 text-amber-200"
                    : "bg-zinc-800 text-zinc-500"
              }`}
              aria-hidden
            >
              {step.done ? "✓" : i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-zinc-200">{step.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[progress.playerA, progress.playerB].map((p) => (
          <div
            key={p.label}
            className="rounded-lg border border-white/8 bg-black/20 px-3 py-2.5 text-xs"
          >
            <p className="font-semibold text-zinc-200">{p.label}</p>
            <p className="mt-1 text-zinc-500">
              Début :{" "}
              <span className={p.started ? "text-emerald-400" : "text-amber-400/90"}>
                {p.started ? "confirmé" : "en attente"}
              </span>
            </p>
            <p className="text-zinc-500">
              Score déclaré :{" "}
              <span className="font-mono text-zinc-300">{p.claim ?? "—"}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
