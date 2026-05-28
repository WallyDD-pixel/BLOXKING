import { PVP_DISABLED_PLAYER_MESSAGE } from "@/lib/site/pvp-messages";

export function PvpDisabledBanner() {
  return (
    <div
      className="rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-4"
      role="status"
    >
      <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-red-200">
        PvP désactivé
      </p>
      <p className="mt-2 text-sm leading-relaxed text-red-100/95">
        {PVP_DISABLED_PLAYER_MESSAGE}
      </p>
    </div>
  );
}
