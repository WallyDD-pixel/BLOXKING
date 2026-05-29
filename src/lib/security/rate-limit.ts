type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Rate limit en mémoire (OK pour une instance EC2 ; utiliser Redis si multi-instances). */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  bucket.count += 1;
  return { ok: true };
}

export function rateLimitKey(prefix: string, ip: string): string {
  return `${prefix}:${ip || "unknown"}`;
}
