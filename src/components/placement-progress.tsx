import { isPlacementComplete, PLACEMENT_TOTAL } from "@/lib/ranked";

type PlacementProgressProps = {
  elo: number;
  placementMatchesPlayed: number;
};

function placementHint(played: number, total: number): string {
  const left = total - played;
  if (left === 1) {
    return "Dernier match de placement : après celui-ci, ton ELO sera « classé ».";
  }
  return `Encore ${left} match${left > 1 ? "s" : ""} pour terminer le placement.`;
}

export function PlacementProgress({
  elo,
  placementMatchesPlayed,
}: PlacementProgressProps) {
  const total = PLACEMENT_TOTAL;
  const done = Math.min(placementMatchesPlayed, total);
  const pct = Math.round((done / total) * 100);
  const complete = isPlacementComplete(placementMatchesPlayed);

  if (complete) {
    return (
      <div className="space-y-1">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-zinc-500">
          ELO classé
        </p>
        <p className="font-mono text-3xl font-semibold tabular-nums text-amber-300/95 sm:text-4xl">
          {elo}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-zinc-500">
          Placement ranked
        </p>
        <p className="mt-1 font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-white sm:text-4xl">
          {done}/{total}
        </p>
      </div>

      <div className="game-hud-bar overflow-hidden">
        <div
          className="game-hud-bar-fill bg-amber-500/90 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol
        className="flex justify-between gap-1.5"
        aria-label="Progression placement"
      >
        {Array.from({ length: total }, (_, i) => {
          const filled = i < done;
          return (
            <li
              key={i}
              className={`h-2.5 min-w-0 flex-1 rounded-full transition-colors ${
                filled
                  ? "bg-amber-400/85"
                  : "border border-zinc-600/80 bg-zinc-900/80"
              }`}
            />
          );
        })}
      </ol>

      <p className="text-sm leading-relaxed text-zinc-400 sm:text-[0.95rem]">
        {placementHint(done, total)}
      </p>
    </div>
  );
}
