-- Présence utilisateurs (en ligne / activité récente sur le site).
-- psql -U bloxking -d bloxking -h localhost -f db/09_user_presence.sql

alter table public.users
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_path text;

create index if not exists idx_users_last_seen_at
  on public.users (last_seen_at desc nulls last)
  where last_seen_at is not null;
