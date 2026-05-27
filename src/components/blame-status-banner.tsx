import {
  BLAME_FAIR_WINS_REQUIRED,
  BLAME_LOSS_ELO_MULTIPLIER,
} from "@/lib/moderation/blame-constants";

type Props = {
  fairWinsDone: number;
  fairWinsRequired: number;
};

export function BlameStatusBanner({ fairWinsDone, fairWinsRequired }: Props) {
  const required = fairWinsRequired || BLAME_FAIR_WINS_REQUIRED;
  const done = Math.min(fairWinsDone, required);

  return (
    <div
      className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4"
      role="status"
    >
      <p className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-300">
        Sanction active — blame
      </p>
      <p className="mt-2 text-sm leading-relaxed text-amber-100/95">
        Tu dois gagner{" "}
        <strong className="text-white">
          {required} matchs à la loyale
        </strong>{" "}
        (sans litige) pour retirer le blame. Progression :{" "}
        <strong className="text-white">
          {done}/{required}
        </strong>
        . En attendant, une défaite te fait perdre environ{" "}
        <strong className="text-white">×{BLAME_LOSS_ELO_MULTIPLIER} ELO</strong>.
      </p>
    </div>
  );
}
