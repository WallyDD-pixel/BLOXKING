import type { PoolClient, QueryResultRow } from "pg";
import { getPool } from "./pool";

/** Définit l'utilisateur courant pour les fonctions SQL (remplace auth.uid()). */
export async function withAppUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function rpcJson<T extends QueryResultRow = QueryResultRow>(
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  return withAppUser(userId, async (client) => {
    const res = await client.query<T>(sql, params);
    return res.rows[0] ?? null;
  });
}

/** Appel RPC sans utilisateur (tâches système). */
export async function rpcJsonSystem<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const pool = getPool();
  const res = await pool.query<T>(sql, params);
  return res.rows[0] ?? null;
}
