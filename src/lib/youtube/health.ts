import { getYoutubeChannelContext } from "@/lib/youtube/channel";
import { youtubeApiKey, youtubeChannelHandle } from "@/lib/youtube/config";
import { fetchYoutubeJson, youtubeUrl } from "@/lib/youtube/fetch";
import { getYoutubeLatestVideo } from "@/lib/youtube/latest-video";
import { getYoutubeLiveStream } from "@/lib/youtube/live";

export type YoutubeApiHealth = {
  ok: boolean;
  hasApiKey: boolean;
  handle: string;
  channelId: string | null;
  liveVideoId: string | null;
  latestVideoId: string | null;
  error: string | null;
  googleStatus: number | null;
  quotaNote: string | null;
};

export async function getYoutubeApiHealth(): Promise<YoutubeApiHealth> {
  const handle = youtubeChannelHandle();
  const key = youtubeApiKey();

  if (!key) {
    return {
      ok: false,
      hasApiKey: false,
      handle,
      channelId: null,
      liveVideoId: null,
      latestVideoId: null,
      error: "YOUTUBE_API_KEY absente ou placeholder sur le serveur (Vercel → Environment Variables).",
      googleStatus: null,
      quotaNote: null,
    };
  }

  const ctx = await getYoutubeChannelContext();

  if (!ctx) {
    const url = youtubeUrl("channels", key, {
      part: "id",
      forHandle: handle,
    });
    const probe = await fetchYoutubeJson<{ items?: { id: string }[] }>(url, {
      cache: "no-store",
    });

    const isQuota =
      probe.ok === false &&
      (probe.error.status === 403 ||
        probe.error.message.toLowerCase().includes("quota"));

    return {
      ok: false,
      hasApiKey: true,
      handle,
      channelId: null,
      liveVideoId: null,
      latestVideoId: null,
      error: probe.ok
        ? `Chaîne @${handle} introuvable.`
        : isQuota
          ? `Quota YouTube API épuisé : ${probe.error.message}`
          : probe.error.message,
      googleStatus: probe.ok ? 200 : probe.error.status || null,
      quotaNote: isQuota
        ? "Le quota se réinitialise à minuit (heure du Pacifique). Évite /api/youtube/status en boucle — chaque test consomme des unités."
        : null,
    };
  }

  const [live, latest] = await Promise.all([
    getYoutubeLiveStream(),
    getYoutubeLatestVideo(),
  ]);

  return {
    ok: true,
    hasApiKey: true,
    handle,
    channelId: ctx.channelId,
    liveVideoId: live?.videoId ?? null,
    latestVideoId: latest?.videoId ?? null,
    error:
      live || latest
        ? null
        : "API OK mais aucune vidéo longue récente trouvée (Shorts exclus).",
    googleStatus: 200,
    quotaNote: null,
  };
}
