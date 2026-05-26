"use client";

import { usePathname } from "next/navigation";
import { PvpRecordingTip } from "@/components/pvp-recording-tip";

/** Bandeau conseil enregistrement sur l’espace /play (sauf salle de match, déjà détaillée). */
export function PlayAreaPvpTip() {
  const pathname = usePathname();
  if (pathname.startsWith("/play/match/")) return null;

  return <PvpRecordingTip variant="compact" className="mb-6" />;
}
