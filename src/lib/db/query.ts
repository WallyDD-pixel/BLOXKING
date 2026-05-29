import type { QueryResultRow } from "pg";
import { clientSafeError } from "@/lib/security/sanitize-error";
import { getPool } from "./pool";

function formatDbError(err: unknown): Error {
  if (process.env.NODE_ENV === "production") {
    return new Error(clientSafeError(err));
  }

  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: string }).message)
      : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";

  if (
    /ECONNREFUSED|connect ETIMEDOUT|timeout|ENOTFOUND/i.test(msg) ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND"
  ) {
    return new Error(
      "Impossible de joindre la base de données. Vérifie DATABASE_URL sur le serveur.",
    );
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

