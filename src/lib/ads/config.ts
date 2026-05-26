/** Identifiant éditeur AdSense (ex. ca-pub-XXXXXXXXXXXXXXXX). */
export function adsenseClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  return id || null;
}

export type AdPlacement = "sidebar-left" | "sidebar-right" | "banner-top";

const SLOT_ENV: Record<AdPlacement, string> = {
  "sidebar-left": "NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR_LEFT",
  "sidebar-right": "NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR_RIGHT",
  "banner-top": "NEXT_PUBLIC_ADSENSE_SLOT_BANNER_TOP",
};

export function adsenseSlotId(placement: AdPlacement): string | null {
  const key = SLOT_ENV[placement];
  const id = process.env[key]?.trim();
  return id || null;
}

/** Vrai si au moins le client AdSense est configuré. */
export function adsConfigured(): boolean {
  return Boolean(adsenseClientId());
}

/** Emplacement prêt (client + slot). */
export function isAdPlacementConfigured(placement: AdPlacement): boolean {
  return Boolean(adsenseClientId() && adsenseSlotId(placement));
}

/**
 * Cadres « Espace pub » uniquement si explicitement activé
 * (NEXT_PUBLIC_ADS_PLACEHOLDERS=true). Jamais par défaut.
 */
export function showAdPlaceholders(): boolean {
  return process.env.NEXT_PUBLIC_ADS_PLACEHOLDERS === "true";
}
