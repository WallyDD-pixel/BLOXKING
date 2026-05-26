-- Réinitialise le schéma ranked (garde users + sessions).
-- À lancer si une migration précédente a échoué à mi-chemin.

drop table if exists public.match_dispute_chat_messages cascade;
drop table if exists public.match_dispute_tickets cascade;
drop table if exists public.matchmaking_rpc_log cascade;
drop table if exists public.match_queue cascade;
drop table if exists public.player_ranked_stats cascade;
drop table if exists public.matches cascade;
drop table if exists public.open_challenges cascade;

drop function if exists public.repair_match_elo_delta_columns() cascade;
drop function if exists public.expire_disputed_matches_after_ticket_timeout() cascade;
drop function if exists public.match_finalize(uuid) cascade;
drop function if exists public.apply_elo_after_match_confirm(uuid) cascade;
drop function if exists public.match_reset_after_dispute(uuid) cascade;
drop function if exists public.match_declare_dispute(uuid) cascade;
drop function if exists public.match_submit_dispute_ticket(uuid, text, text[]) cascade;
drop function if exists public.match_post_dispute_chat_message(uuid, text) cascade;
drop function if exists public.match_accept_opponent_claim(uuid) cascade;
drop function if exists public.match_submit_score_claim(uuid, int, int) cascade;
drop function if exists public.match_confirm_started(uuid) cascade;
drop function if exists public.match_sync_dispute_from_claims(uuid) cascade;
drop function if exists public.is_valid_bo3_maps(int, int) cascade;
drop function if exists public.accept_open_challenge(uuid) cascade;
drop function if exists public.join_ranked_queue(jsonb) cascade;
drop function if exists public.join_ranked_queue() cascade;
drop function if exists public.match_dispute_paths_valid(text[], uuid, uuid) cascade;
drop function if exists public.user_has_open_ranked_match(uuid) cascade;
