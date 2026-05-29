/** Message générique pour le client (évite les fuites Postgres / schéma). */
export const GENERIC_CLIENT_ERROR =
  "Une erreur est survenue. Réessaie ou contacte le support si le problème persiste.";

const PG_LEAK =
  /invalid input syntax|relation |column |duplicate key|violates|syntax error|pg_|postgres|uuid:/i;

export function clientSafeError(err: unknown, devFallback?: string): string {
  if (process.env.NODE_ENV !== "production") {
    if (err instanceof Error) return err.message;
    if (devFallback) return devFallback;
    return String(err);
  }

  const msg =
    err instanceof Error
      ? err.message
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "";

  if (PG_LEAK.test(msg)) return GENERIC_CLIENT_ERROR;
  if (/ECONNREFUSED|connect|joindre PostgreSQL|DATABASE_URL/i.test(msg)) {
    return "Service temporairement indisponible. Réessaie dans quelques instants.";
  }

  return GENERIC_CLIENT_ERROR;
}
