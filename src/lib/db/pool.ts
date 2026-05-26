import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __bloxking_pg_pool: Pool | undefined;
}

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante: ${name}`);
  return v;
}

export function getPool(): Pool {
  // En dev, Next recharge souvent les modules: on garde un Pool global.
  if (!globalThis.__bloxking_pg_pool) {
    globalThis.__bloxking_pg_pool = new Pool({
      connectionString: mustEnv("DATABASE_URL"),
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalThis.__bloxking_pg_pool;
}

