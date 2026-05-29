-- Index pour polling file (joueur A ou B, match créé après un instant T)
create index if not exists idx_matches_player_a_queue_created
  on public.matches (player_a, created_at desc)
  where source = 'queue';

create index if not exists idx_matches_player_b_queue_created
  on public.matches (player_b, created_at desc)
  where source = 'queue';
