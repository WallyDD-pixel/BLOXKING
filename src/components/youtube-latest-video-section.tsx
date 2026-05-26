import Image from "next/image";
import { YOUTUBE_CHANNEL_URL } from "@/lib/site-links";
import { getYoutubeLatestVideo } from "@/lib/youtube/latest-video";
import { youtubeWatchUrl } from "@/lib/youtube/live";

export async function YoutubeLatestVideoSection() {
  const video = await getYoutubeLatestVideo();
  // Toujours visible sur l'accueil : si indisponible, on affiche un bloc CTA.

  return (
    <section className="relative mt-10 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/60 to-zinc-950/90 p-4 shadow-[0_0_40px_rgba(255,255,255,0.06)] sm:mt-12 sm:p-6">
      <div className="pointer-events-none absolute -right-20 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-zinc-400">
            Dernière vidéo
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-zinc-100 sm:text-3xl">
            Nouveau sur YouTube
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400 line-clamp-2">
            {video
              ? video.title
              : "Retrouve mes vidéos (hors Shorts) directement sur la chaîne."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {video ? (
            <a
              href={youtubeWatchUrl(video.videoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
            >
              Regarder la vidéo
            </a>
          ) : null}
          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-white/10"
          >
            Voir la chaîne
          </a>
        </div>
      </div>

      {video ? (
        <a
          href={youtubeWatchUrl(video.videoId)}
          target="_blank"
          rel="noopener noreferrer"
          className="relative mt-5 block overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg"
          aria-label={`Voir la vidéo : ${video.title}`}
        >
          <div className="aspect-video w-full">
            {video.thumbnailUrl ? (
              <Image
                src={video.thumbnailUrl}
                alt={video.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            ) : (
              <div className="h-full w-full bg-zinc-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-semibold text-zinc-100 backdrop-blur">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
              </span>
              Regarder
            </div>
          </div>
        </a>
      ) : (
        <div className="relative mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-4 text-sm text-zinc-400">
          <p className="font-medium text-zinc-200">Une vidéo apparaîtra ici</p>
          <p className="mt-1 leading-relaxed">
            Dès qu’une vidéo “longue” est trouvée (hors Shorts), elle s’affiche
            automatiquement avec sa miniature.
          </p>
        </div>
      )}
    </section>
  );
}

