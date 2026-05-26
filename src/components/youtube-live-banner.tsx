import { getYoutubeLiveStream, youtubeWatchUrl } from "@/lib/youtube/live";
import { YOUTUBE_CHANNEL_URL } from "@/lib/site-links";

export async function YoutubeLiveBanner() {
  const live = await getYoutubeLiveStream();
  if (!live) return null;

  return (
    <div className="sticky top-2 z-40">
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-0">
        <div className="relative overflow-hidden rounded-2xl border border-red-500/35 bg-gradient-to-r from-red-950/55 via-zinc-950/80 to-zinc-950/80 px-4 py-3 shadow-[0_0_40px_rgba(239,68,68,0.12)] backdrop-blur sm:px-5">
          <div className="pointer-events-none absolute -right-16 -top-10 h-32 w-32 rounded-full bg-red-500/20 blur-3xl" />

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-red-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                Live maintenant
              </span>
              <p className="hidden max-w-[44rem] text-sm text-zinc-300 sm:block line-clamp-1">
                {live.title}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/#live-youtube"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-red-500 px-4 text-sm font-bold text-zinc-950 transition hover:bg-red-400"
              >
                Rejoindre le live
              </a>
              <a
                href={youtubeWatchUrl(live.videoId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/15 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/25"
              >
                Ouvrir sur YouTube
              </a>
              <a
                href={YOUTUBE_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
              >
                Chaîne
              </a>
            </div>
          </div>

          <p className="mt-2 text-xs text-zinc-500 sm:hidden line-clamp-1">
            {live.title}
          </p>
        </div>
      </div>
    </div>
  );
}

