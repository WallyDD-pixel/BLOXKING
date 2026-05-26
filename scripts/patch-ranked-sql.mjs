import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(
  path.join(root, "supabase", "setup_bloxking_ranked.sql"),
  "utf8",
);

let out = src
  .replace(/references auth\.users/gi, "references public.users")
  .replace(/auth\.uid\(\)/g, "(nullif(current_setting('app.user_id', true), '')::uuid)")
  .replace(/to authenticated/gi, "to public")
  .replace(/to anon, authenticated/gi, "to public");

// Retire RLS + storage Supabase
out = out.replace(
  /alter table public\.\w+ enable row level security;\n/g,
  "",
);
out = out.replace(/drop policy if exists[\s\S]*?;\n/g, "");
out = out.replace(/create policy[\s\S]*?;\n/g, "");
out = out.replace(
  /-- Bucket public[\s\S]*?create policy "dispute-evidence read all"[\s\S]*?;\n/g,
  "",
);
out = out.replace(/insert into storage\.buckets[\s\S]*?on conflict \(id\) do nothing;\n/g, "");
out = out.replace(/revoke all on public\.matchmaking_rpc_log[\s\S]*?;\n/g, "");

const header = `-- Généré depuis supabase/setup_bloxking_ranked.sql (sans Supabase Auth/RLS/Storage)
-- Prérequis: db/00_auth.sql
-- Exécuter: psql -U bloxking -d bloxking -h localhost -f db/01_ranked.sql

`;

writeFileSync(path.join(root, "db", "01_ranked.sql"), header + out, "utf8");
console.log("Wrote db/01_ranked.sql");
