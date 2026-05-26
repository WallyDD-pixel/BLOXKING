import type { YoutubeLiveStream } from "@/lib/youtube/live";
import {
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from "@/lib/youtube/live";
import { YOUTUBE_CHANNEL_URL } from "@/lib/site-links";

export function YoutubeLiveSection({ live }: { live: YoutubeLiveStream }) {
  return (
    <section
      id="live-youtube"
      className="relative mt-10 overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-950/40 to-zinc-950/90 p-4 shadow-[0_0_40px_rgba(239,68,68,0.12)] sm:mt-12 sm:p-6"
      aria-labelledby="youtube-live-heading"
    >
      <div className="pointer-events-none absolute -right-16 top-0 h-32 w-32 rounded-full bg-red-500/15 blur-3xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.28em] text-red-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            En direct
          </p>
          <h2
            id="youtube-live-heading"
            className="mt-2 font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-zinc-100 sm:text-3xl"
          >
            Live YouTube
          </h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-400 line-clamp-2">
            {live.title}
          </p>
        </div>
        <a
          href={youtubeWatchUrl(live.videoId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/15 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/25"
        >
          Ouvrir sur YouTube
        </a>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg">
        <div className="aspect-video w-full">
          <iframe
            src={youtubeEmbedUrl(live.videoId)}
            title={live.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>

      <p className="relative mt-4 text-center text-xs text-zinc-600">
        En live — la dernière vidéo est masquée pendant le stream.{" "}
        <a
          href={YOUTUBE_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 underline-offset-2 hover:text-red-300 hover:underline"
        >
          Chaîne YouTube
        </a>
      </p>
    </section>
  );
}
