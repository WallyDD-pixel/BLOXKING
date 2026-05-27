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

function poolSslOption(connectionString: string) {
  if (process.env.DATABASE_SSL !== "true") return undefined;
  try {
    const url = new URL(connectionString.replace(/^postgresql:/i, "postgres:"));
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return undefined;
    }
  } catch {
    /* garde SSL si l’URL est illisible */
  }
  return { rejectUnauthorized: false } as const;
}

function poolMaxConnections(): number {
  const raw = Number(process.env.DATABASE_POOL_MAX ?? "12");
  if (!Number.isFinite(raw)) return 12;
  return Math.min(Math.max(Math.trunc(raw), 2), 30);
}

export function getPool(): Pool {
  // En dev, Next recharge souvent les modules: on garde un Pool global.
  if (!globalThis.__bloxking_pg_pool) {
    const connectionString = mustEnv("DATABASE_URL");
    globalThis.__bloxking_pg_pool = new Pool({
      connectionString,
      ssl: poolSslOption(connectionString),
      max: poolMaxConnections(),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalThis.__bloxking_pg_pool;
}

