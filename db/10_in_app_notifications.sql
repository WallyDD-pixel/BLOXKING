-- Notifications in-app (centre de notifications + badge + popups navigateur)
-- Prérequis: db/00_auth.sql

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (
    kind in (
      'match_result',
      'dispute_opened',
      'dispute_message',
      'match_cancelled',
      'admin_update',
      'system'
    )
  ),
  title text not null,
  body text not null,
  href text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_user_created
  on public.user_notifications (user_id, created_at desc);

create index if not exists idx_user_notifications_user_unread
  on public.user_notifications (user_id, read_at, created_at desc);

grant select, insert, update, delete on public.user_notifications to bloxking;
