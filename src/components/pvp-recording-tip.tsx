import Link from "next/link";
import {
  PVP_RECORDING_BODY,
  PVP_RECORDING_DISPUTE_HINT,
  PVP_RECORDING_LEAD,
  PVP_RECORDING_TIPS,
  PVP_RECORDING_TITLE,
} from "@/lib/pvp-recording-copy";

type Variant = "compact" | "callout" | "inline";

export function PvpRecordingTip({
  variant = "callout",
  className = "",
  showFairPlayLink = false,
}: {
  variant?: Variant;
  className?: string;
  /** Lien vers la section fair play de l’accueil (hors zone /play). */
  showFairPlayLink?: boolean;
}) {
  if (variant === "inline") {
    return (
      <span className={className}>
        <strong className="font-medium text-zinc-200">{PVP_RECORDING_TITLE}</strong>
        {" — "}
        {PVP_RECORDING_LEAD}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <aside
        className={`rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-500/[0.08] to-zinc-950/60 px-4 py-3.5 sm:px-5 sm:py-4 ${className}`}
        aria-label={PVP_RECORDING_TITLE}
      >
        <p className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-sky-300/95">
          {PVP_RECORDING_TITLE}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
          {PVP_RECORDING_LEAD}
        </p>
        {showFairPlayLink ? <FairPlayLink className="mt-2" /> : null}
      </aside>
    );
  }

  return (
    <aside
      className={`rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/[0.1] via-zinc-950/50 to-zinc-950/80 px-4 py-4 sm:px-5 sm:py-5 ${className}`}
      aria-labelledby="pvp-recording-tip-title"
    >
      <p
        id="pvp-recording-tip-title"
        className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-sky-300/95"
      >
        {PVP_RECORDING_TITLE}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-200 sm:text-[0.95rem]">
        {PVP_RECORDING_LEAD}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{PVP_RECORDING_BODY}</p>
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-zinc-500">
        {PVP_RECORDING_TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-zinc-500 sm:text-sm">
        {PVP_RECORDING_DISPUTE_HINT}
      </p>
      {showFairPlayLink ? <FairPlayLink className="mt-3" /> : null}
    </aside>
  );
}

function FairPlayLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/#fair-play-heading"
      className={`inline-block font-mono text-[0.65rem] uppercase tracking-wider text-sky-400/90 underline-offset-2 hover:text-sky-300 hover:underline ${className}`}
    >
      Règles fair play & litiges →
    </Link>
  );
}
