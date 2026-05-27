\set ON_ERROR_STOP on
SELECT coalesce(d.dodge_count, 0) AS cnt
FROM public.player_opponent_start_dodges d
WHERE d.user_id = '00000000-0000-0000-0000-000000000001'
  AND d.opponent_id = '00000000-0000-0000-0000-000000000002';
