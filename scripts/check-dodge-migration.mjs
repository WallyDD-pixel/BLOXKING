import { readFileSync } from "node:fs";
import { Pool } from "pg";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sslFlag = env.match(/^DATABASE_SSL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL manquant dans .env.local");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: sslFlag === "true" ? { rejectUnauthorized: false } : undefined,
});

const tests = [
  [
    "get_start_dodge_count (app user)",
    "select public.get_start_dodge_count('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid)",
  ],
  [
    "direct table select (bloxking grant)",
    "select 1 from public.player_opponent_start_dodges limit 0",
  ],
  [
    "expire_pending_matches_after_start_timeout",
    "select public.expire_pending_matches_after_start_timeout()",
  ],
];

for (const [name, sql] of tests) {
  try {
    await pool.query(sql);
    console.log(`${name}: OK`);
  } catch (e) {
    console.log(`${name}: FAIL — ${e.message}`);
  }
}

await pool.end();
