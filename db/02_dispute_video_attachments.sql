-- Extension preuves litige : vidéos MP4 / WebM (en plus des images).
-- À exécuter une fois sur la base existante :
--   psql -U bloxking -d bloxking -h localhost -f db/02_dispute_video_attachments.sql

create or replace function public.match_dispute_paths_valid(
  p_paths text[],
  p_match_id uuid,
  p_uid uuid
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  p text;
  parts text[];
  n int;
  video_count int := 0;
begin
  n := cardinality(coalesce(p_paths, '{}'));
  if n > 5 then
    return false;
  end if;
  if n = 0 then
    return true;
  end if;
  foreach p in array coalesce(p_paths, '{}')
  loop
    parts := string_to_array(p, '/');
    if array_length(parts, 1) is distinct from 4 then
      return false;
    end if;
    if parts[1] is distinct from 'dispute' then
      return false;
    end if;
    if parts[2] is distinct from p_match_id::text then
      return false;
    end if;
    if parts[3] is distinct from p_uid::text then
      return false;
    end if;
    if parts[4] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp|mp4|webm)$' then
      return false;
    end if;
    if parts[4] ~ '\.(mp4|webm)$' then
      video_count := video_count + 1;
    end if;
  end loop;
  if video_count > 1 then
    return false;
  end if;
  return true;
end;
$$;
