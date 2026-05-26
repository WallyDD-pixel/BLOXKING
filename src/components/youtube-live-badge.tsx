import { getYoutubeLiveStream, youtubeWatchUrl } from "@/lib/youtube/live";

export async function YoutubeLiveBadge({
  className = "",
}: {
  className?: string;
}) {
  const live = await getYoutubeLiveStream();
  if (!live) return null;

  return (
    <a
      href={youtubeWatchUrl(live.videoId)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-red-100 transition hover:bg-red-500/20 ${className}`}
      aria-label="Live YouTube en cours"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      LIVE
    </a>
  );
}

