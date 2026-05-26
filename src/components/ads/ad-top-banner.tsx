import { AdSlot } from "@/components/ads/ad-slot";
import {
  isAdPlacementConfigured,
  showAdPlaceholders,
} from "@/lib/ads/config";

export function AdTopBanner() {
  if (!isAdPlacementConfigured("banner-top") && !showAdPlaceholders()) {
    return null;
  }

  return (
    <AdSlot
      placement="banner-top"
      className="w-full"
      wrapperClassName="mx-auto mb-6 w-full max-w-4xl"
    />
  );
}
