-- Anti auto-match : ne pas jumeler deux comptes depuis la même IP.

alter table public.match_queue
  add column if not exists client_ip inet;

create index if not exists idx_match_queue_client_ip
  on public.match_queue (client_ip)
  where client_ip is not null;
