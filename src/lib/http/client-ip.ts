/** Extrait l’IP client derrière nginx (X-Forwarded-For / X-Real-IP). */
export function getClientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && isPlausibleClientIp(first)) return first;
  }

  const real = headers.get("x-real-ip")?.trim();
  if (real && isPlausibleClientIp(real)) return real;

  return null;
}

/** IPv4 ou IPv6 (forme simple, sans validation complète). */
export function isPlausibleClientIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  if (ip.includes(":")) {
    return /^[0-9a-f:.]+$/i.test(ip);
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

/** Même connexion réseau (IP identique), pour anti multi-compte en file. */
export function sameClientConnection(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
