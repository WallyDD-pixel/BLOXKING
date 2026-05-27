/** Fuseau d'affichage (SSR Vercel = UTC sans timeZone explicite). */
export const SITE_TIME_ZONE =
  process.env.NEXT_PUBLIC_SITE_TIME_ZONE?.trim() || "Europe/Paris";

const LOCALE = "fr-FR";

type DateInput = string | number | Date;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTimeFr(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleString(LOCALE, {
    timeZone: SITE_TIME_ZONE,
    ...options,
  });
}

export function formatDateFr(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleDateString(LOCALE, {
    timeZone: SITE_TIME_ZONE,
    ...options,
  });
}

export function formatTimeFr(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleTimeString(LOCALE, {
    timeZone: SITE_TIME_ZONE,
    ...options,
  });
}
