import { fetchYoutubeJson, youtubeUrl } from "@/lib/youtube/fetch";

export type YoutubeApiHealth = {
  ok: boolean;
  hasApiKey: boolean;
  handle: string;
  channelId: string | null;
  liveVideoId: string | null;
  latestVideoId: string | null;
  error: string | null;
  googleStatus: number | null;
};

function apiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key || key === "ta_cle" || key === "ta_cle_api_google") return null;
  return key;
}

function channelHandle(): string {
  return (process.env.YOUTUBE_CHANNEL_HANDLE ?? "warrenoff").replace(/^@/, "");
}

export async function getYoutubeApiHealth(): Promise<YoutubeApiHealth> {
  const handle = channelHandle();
  const key = apiKey();

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
    };
  }

  const channelUrl = youtubeUrl("channels", key, {
    part: "id,contentDetails",
    forHandle: handle,
  });
  const channelRes = await fetchYoutubeJson<{
    items?: Array<{ id: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
    error?: { message?: string; errors?: { reason?: string }[] };
  }>(channelUrl, { cache: "no-store" });

  if (!channelRes.ok) {
    const hint =
      channelRes.error.status === 403
        ? "Clé invalide, quota dépassé ou YouTube Data API v3 non activée. Restrictions Google Cloud → Application = Aucun."
        : "Appel Google refusé — vérifie la clé API et YouTube Data API v3.";
    return {
      ok: false,
      hasApiKey: true,
      handle,
      channelId: null,
      liveVideoId: null,
      latestVideoId: null,
      error: `${hint} (${channelRes.error.message})`,
      googleStatus: channelRes.error.status || null,
    };
  }

  const channel = channelRes.data.items?.[0];
  if (!channel?.id) {
    const msg = channelRes.data.error?.message ?? `Chaîne @${handle} introuvable.`;
    return {
      ok: false,
      hasApiKey: true,
      handle,
      channelId: null,
      liveVideoId: null,
      latestVideoId: null,
      error: msg,
      googleStatus: 200,
    };
  }

  const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads;
  let latestVideoId: string | null = null;

  if (uploadsId) {
    const plUrl = youtubeUrl("playlistItems", key, {
      part: "snippet",
      playlistId: uploadsId,
      maxResults: "15",
    });
    const plRes = await fetchYoutubeJson<{
      items?: Array<{ snippet?: { resourceId?: { videoId?: string } } }>;
    }>(plUrl, { cache: "no-store" });

    if (plRes.ok) {
      const ids =
        plRes.data.items
          ?.map((i) => i.snippet?.resourceId?.videoId)
          .filter((v): v is string => Boolean(v)) ?? [];

      if (ids.length > 0) {
        const vidUrl = youtubeUrl("videos", key, {
          part: "contentDetails,liveStreamingDetails",
          id: ids.join(","),
        });
        const vidRes = await fetchYoutubeJson<{
          items?: Array<{
            id: string;
            contentDetails?: { duration?: string };
            liveStreamingDetails?: unknown;
          }>;
        }>(vidUrl, { cache: "no-store" });

        if (vidRes.ok) {
          const details = new Map(
            (vidRes.data.items ?? []).map((v) => [v.id, v]),
          );
          for (const id of ids) {
            const d = details.get(id);
            if (!d || d.liveStreamingDetails) continue;
            const dur = d.contentDetails?.duration ?? "";
            const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(dur);
            const sec = m
              ? Number(m[1] ?? 0) * 3600 +
                Number(m[2] ?? 0) * 60 +
                Number(m[3] ?? 0)
              : 0;
            if (sec >= 120) {
              latestVideoId = id;
              break;
            }
          }
        }
      }
    }
  }

  const liveUrl = youtubeUrl("search", key, {
    part: "snippet",
    channelId: channel.id,
    type: "video",
    eventType: "live",
    maxResults: "1",
  });
  const liveRes = await fetchYoutubeJson<{
    items?: Array<{ id: { videoId?: string } }>;
  }>(liveUrl, { cache: "no-store" });
  const liveVideoId = liveRes.ok
    ? liveRes.data.items?.[0]?.id?.videoId ?? null
    : null;

  return {
    ok: true,
    hasApiKey: true,
    handle,
    channelId: channel.id,
    liveVideoId,
    latestVideoId,
    error: latestVideoId || liveVideoId ? null : "API OK mais aucune vidéo longue récente trouvée (Shorts exclus).",
    googleStatus: 200,
  };
}
