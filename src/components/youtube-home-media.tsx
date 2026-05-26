import { YoutubeLatestVideoSection } from "@/components/youtube-latest-video-section";
import { YoutubeLivePopin } from "@/components/youtube-live-popin";
import { YoutubeLiveSection } from "@/components/youtube-live-section";
import {
  getYoutubeLiveStream,
  youtubeWatchUrl,
} from "@/lib/youtube/live";

/** Accueil : live OU dernière vidéo (jamais les deux). */
export async function YoutubeHomeMedia() {
  const live = await getYoutubeLiveStream();

  if (live) {
    return (
      <>
        <YoutubeLiveSection live={live} />
        <YoutubeLivePopin
          title={live.title}
          watchUrl={youtubeWatchUrl(live.videoId)}
        />
      </>
    );
  }

  return <YoutubeLatestVideoSection />;
}
