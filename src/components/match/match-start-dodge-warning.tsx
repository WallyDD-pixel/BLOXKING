import {
  START_DODGE_FORFEIT_COUNT,
  START_DODGE_WARN_COUNT,
} from "@/lib/match/start-dodge-constants";

type Props = {
  opponentLabel: string;
  dodgeCountVsOpponent: number;
};

export function MatchStartDodgeWarning({
  opponentLabel,
  dodgeCountVsOpponent,
}: Props) {
  if (dodgeCountVsOpponent < 1) return null;

  const atRisk = dodgeCountVsOpponent >= START_DODGE_WARN_COUNT;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        atRisk
          ? "border-red-500/45 bg-red-500/10"
          : "border-amber-500/35 bg-amber-500/10"
      }`}
      role="status"
    >
      {atRisk ? (
        <>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-red-300">
            Dernier avertissement — esquive
          </p>
          <p className="mt-2 text-sm leading-relaxed text-red-100/95">
            Tu as déjà esquivé{" "}
            <strong className="text-white">{START_DODGE_WARN_COUNT} fois</strong>{" "}
            le début de match (2 min) contre{" "}
            <strong className="text-white">{opponentLabel}</strong>. Si tu
            n&apos;confirmes pas dans les{" "}
            <strong className="text-white">2 minutes</strong>, tu perds ce match
            automatiquement (<strong className="text-white">2-0</strong> + perte
            d&apos;ELO).
          </p>
        </>
      ) : (
        <>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-300">
            Esquives enregistrées
          </p>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/95">
            Tu as déjà esquivé{" "}
            <strong className="text-white">{dodgeCountVsOpponent}</strong> fois
            le début de match contre{" "}
            <strong className="text-white">{opponentLabel}</strong> (2 min
            sans confirmer). Après{" "}
            <strong className="text-white">{START_DODGE_FORFEIT_COUNT}</strong>{" "}
            esquives, la suivante = défaite automatique 2-0.
          </p>
        </>
      )}
    </div>
  );
}
