-- L'app se connecte en tant que bloxking : lecture du compteur d'esquives.

grant select on public.player_opponent_start_dodges to bloxking;

create or replace function public.get_start_dodge_count(
  p_user_id uuid,
  p_opponent_id uuid
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select d.dodge_count
      from public.player_opponent_start_dodges d
      where d.user_id = p_user_id
        and d.opponent_id = p_opponent_id
    ),
    0
  );
$$;

grant execute on function public.get_start_dodge_count(uuid, uuid) to public;
