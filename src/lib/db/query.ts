import type { QueryResultRow } from "pg";
import { getPool } from "./pool";

function formatDbError(err: unknown): Error {
  if (err && typeof err === "object" && "errors" in err) {
    const inner = (err as { errors?: unknown[] }).errors;
    if (Array.isArray(inner) && inner.length > 0) {
      const parts = inner
        .map((e) =>
          e && typeof e === "object" && "message" in e
            ? String((e as { message: string }).message)
            : String(e),
        )
        .filter(Boolean);
      if (parts.some((p) => /ECONNREFUSED|connect/i.test(p))) {
        return new Error(
          "Impossible de joindre PostgreSQL (DATABASE_URL). Sur ton PC : tunnel SSH vers EC2 ou Postgres local. Vérifie aussi que le mot de passe dans l’URL encode les caractères spéciaux (& → %26).",
        );
      }
      return new Error(parts.join(" · "));
    }
  }
  if (err instanceof Error) return err;
  return new Error(String(err));
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  try {
    const res = await pool.query<T>(text, params);
    return res.rows;
  } catch (e) {
    throw formatDbError(e);
  }
}

export async function dbQueryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await dbQuery<T>(text, params);
  return rows[0] ?? null;
}

