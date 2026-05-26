import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let src = readFileSync(
  path.join(root, "supabase", "setup_bloxking_ranked.sql"),
  "utf8",
);

// BOM UTF-8 (sinon psql: syntax error at /*)
src = src.replace(/^\uFEFF/, "");

let out = src
  .replace(/references auth\.users/gi, "references public.users")
  .replace(/auth\.uid\(\)/g, "(nullif(current_setting('app.user_id', true), '')::uuid)")
  .replace(/to authenticated/gi, "to public")
  .replace(/to anon, authenticated/gi, "to public")
  .replace(/to service_role/gi, "to public");

// Retire le gros commentaire d’en-tête Supabase
out = out.replace(/^\/\*[\s\S]*?\*\/\s*\n/, "");

// RLS
out = out.replace(
  /alter table public\.\w+ enable row level security;\n/g,
  "",
);
out = out.replace(/drop policy if exists[\s\S]*?;\n/g, "");
out = out.replace(/create policy[\s\S]*?;\n/g, "");

// Storage Supabase (bucket + policies)
out = out.replace(
  /insert into storage\.buckets[\s\S]*?allowed_mime_types = excluded\.allowed_mime_types;\n/g,
  "",
);
out = out.replace(
  /-- Bucket public[\s\S]*?create policy "dispute-evidence read all"[\s\S]*?;\n/g,
  "",
);

out = out.replace(/revoke all on public\.matchmaking_rpc_log[\s\S]*?;\n/g, "");

// PostgREST notify (inutile hors Supabase)
out = out.replace(/\nnotify pgrst, 'reload schema';\n/g, "\n");

const header = `-- BLOXKING ranked (PostgreSQL local, sans Supabase)
-- Prérequis: db/00_auth.sql
-- psql -U bloxking -d bloxking -h localhost -f db/01_ranked.sql

`;

writeFileSync(path.join(root, "db", "01_ranked.sql"), header + out, { encoding: "utf8" });
console.log("Wrote db/01_ranked.sql");
