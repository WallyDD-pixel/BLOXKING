-- Interrupteur global PvP / matchmaking (modération indisponible).

create table if not exists public.site_operational_state (
  id int primary key default 1 check (id = 1),
  pvp_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null
);

insert into public.site_operational_state (id, pvp_enabled)
values (1, true)
on conflict (id) do nothing;

grant select, update on public.site_operational_state to bloxking;
