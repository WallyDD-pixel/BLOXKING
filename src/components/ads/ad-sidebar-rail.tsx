import { AdSlot } from "@/components/ads/ad-slot";
import {
  isAdPlacementConfigured,
  showAdPlaceholders,
} from "@/lib/ads/config";

type AdSidebarRailProps = {
  side: "left" | "right";
};

export function AdSidebarRail({ side }: AdSidebarRailProps) {
  const placement = side === "left" ? "sidebar-left" : "sidebar-right";

  if (!isAdPlacementConfigured(placement) && !showAdPlaceholders()) {
    return null;
  }

  return <AdSlot placement={placement} className="w-[160px]" />;
}
