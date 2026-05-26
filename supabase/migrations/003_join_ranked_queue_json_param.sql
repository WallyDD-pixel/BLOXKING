-- Remplace join_ranked_queue() par join_ranked_queue(jsonb) pour PostgREST / cache schéma.
-- À exécuter si tu avais déjà créé l’ancienne version sans paramètre.

drop function if exists public.join_ranked_queue();

create or replace function public.join_ranked_queue(queue_ctx jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  partner uuid;
  new_id uuid;
  pa uuid;
  pb uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  insert into match_queue (user_id, created_at)
  values (uid, now())
  on conflict (user_id) do update set created_at = excluded.created_at;

  select mq.user_id into partner
  from match_queue mq
  where mq.user_id <> uid
  order by mq.created_at asc
  limit 1;

  if partner is null then
    return jsonb_build_object('matched', false);
  end if;

  delete from match_queue where user_id in (uid, partner);

  if uid::text < partner::text then
    pa := uid; pb := partner;
  else
    pa := partner; pb := uid;
  end if;

  insert into matches (player_a, player_b, source, status)
  values (pa, pb, 'queue', 'pending')
  returning id into new_id;

  return jsonb_build_object(
    'matched', true,
    'match_id', new_id,
    'opponent_id', partner
  );
end;
$$;

grant execute on function public.join_ranked_queue(jsonb) to authenticated;

notify pgrst, 'reload schema';
