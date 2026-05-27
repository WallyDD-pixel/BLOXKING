SELECT has_table_privilege('bloxking', 'public.player_opponent_start_dodges', 'SELECT') AS bloxking_can_select;
SELECT p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_start_dodge_count';
