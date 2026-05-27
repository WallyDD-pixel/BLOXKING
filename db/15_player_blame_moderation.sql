-- Blame / ban modération (litiges admin).
-- Prérequis: db/00_auth.sql, db/01_ranked.sql, db/03_admin.sql

alter table public.users
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text,
  add column if not exists banned_by uuid references public.users (id) on delete set null;

create index if not exists idx_users_banned_at
  on public.users (banned_at)
  where banned_at is not null;

alter table public.player_ranked_stats
  add column if not exists blame_active boolean not null default false,
  add column if not exists blame_fair_wins_required int not null default 0
    check (blame_fair_wins_required >= 0 and blame_fair_wins_required <= 10),
  add column if not exists blame_fair_wins_done int not null default 0
    check (blame_fair_wins_done >= 0 and blame_fair_wins_done <= 10),
  add column if not exists blame_count int not null default 0
    check (blame_count >= 0),
  add column if not exists blame_note text,
  add column if not exists blame_match_id uuid references public.matches (id) on delete set null,
  add column if not exists blame_applied_at timestamptz;

create table if not exists public.player_moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  admin_id uuid references public.users (id) on delete set null,
  match_id uuid references public.matches (id) on delete set null,
  kind text not null check (
    kind in ('blame_applied', 'blame_cleared', 'blame_progress', 'ban', 'unban')
  ),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_moderation_events_user
  on public.player_moderation_events (user_id, created_at desc);

create or replace function public.user_is_banned(p_uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.users u
    where u.id = p_uid
      and u.banned_at is not null
  );
$$;

create or replace function public.admin_apply_player_blame(
  p_user_id uuid,
  p_match_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_fair_wins int := 2;
begin
  perform public.assert_app_user_is_admin();

  if not exists (select 1 from public.users where id = p_user_id) then
    return jsonb_build_object('error', 'user_not_found');
  end if;

  if public.user_is_banned(p_user_id) then
    return jsonb_build_object('error', 'user_banned');
  end if;

  insert into public.player_ranked_stats (user_id, elo, placement_matches_played)
  values (p_user_id, 1000, 0)
  on conflict (user_id) do nothing;

  update public.player_ranked_stats
  set
    blame_active = true,
    blame_fair_wins_required = v_fair_wins,
    blame_fair_wins_done = 0,
    blame_count = blame_count + 1,
    blame_note = nullif(trim(p_note), ''),
    blame_match_id = p_match_id,
    blame_applied_at = now(),
    updated_at = now()
  where user_id = p_user_id;

  insert into public.player_moderation_events (user_id, admin_id, match_id, kind, note)
  values (p_user_id, uid, p_match_id, 'blame_applied', nullif(trim(p_note), ''));

  return jsonb_build_object('ok', true, 'fair_wins_required', v_fair_wins);
end;
$$;

create or replace function public.admin_clear_player_blame(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
begin
  perform public.assert_app_user_is_admin();

  if not exists (select 1 from public.users where id = p_user_id) then
    return jsonb_build_object('error', 'user_not_found');
  end if;

  update public.player_ranked_stats
  set
    blame_active = false,
    blame_fair_wins_required = 0,
    blame_fair_wins_done = 0,
    blame_note = null,
    blame_match_id = null,
    blame_applied_at = null,
    updated_at = now()
  where user_id = p_user_id;

  insert into public.player_moderation_events (user_id, admin_id, kind, note)
  values (p_user_id, uid, 'blame_cleared', 'levé manuellement par admin');

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_ban_user(
  p_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
begin
  perform public.assert_app_user_is_admin();

  if not exists (select 1 from public.users where id = p_user_id) then
    return jsonb_build_object('error', 'user_not_found');
  end if;

  update public.users
  set
    banned_at = now(),
    ban_reason = nullif(trim(p_reason), ''),
    banned_by = uid
  where id = p_user_id;

  delete from public.match_queue where user_id = p_user_id;
  delete from public.sessions where user_id = p_user_id;

  insert into public.player_moderation_events (user_id, admin_id, kind, note)
  values (p_user_id, uid, 'ban', nullif(trim(p_reason), ''));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_unban_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
begin
  perform public.assert_app_user_is_admin();

  update public.users
  set
    banned_at = null,
    ban_reason = null,
    banned_by = null
  where id = p_user_id;

  if not found then
    return jsonb_build_object('error', 'user_not_found');
  end if;

  insert into public.player_moderation_events (user_id, admin_id, kind, note)
  values (p_user_id, uid, 'unban', null);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.user_is_banned(uuid) to public;
grant execute on function public.admin_apply_player_blame(uuid, uuid, text) to public;
grant execute on function public.admin_clear_player_blame(uuid) to public;
grant execute on function public.admin_ban_user(uuid, text) to public;
grant execute on function public.admin_unban_user(uuid) to public;
