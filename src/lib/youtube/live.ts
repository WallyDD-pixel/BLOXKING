import { unstable_cache } from "next/cache";
import { getYoutubeChannelContext } from "@/lib/youtube/channel";
import { youtubeApiKey } from "@/lib/youtube/config";
import { fetchYoutubeJson, youtubeUrl } from "@/lib/youtube/fetch";

export type YoutubeLiveStream = {
  videoId: string;
  title: string;
};

/** 5 min — détection live sans search.list (100 unités). */
const CACHE_SECONDS = 5 * 60;

type PlaylistItemsResponse = {
  items?: Array<{
    snippet?: {
      title?: string;
      resourceId?: { videoId?: string };
    };
  }>;
};

type LiveStreamingDetails = {
  actualStartTime?: string;
  actualEndTime?: string;
};

type VideosResponse = {
  items?: Array<{
    id: string;
    snippet?: { title?: string };
    liveStreamingDetails?: LiveStreamingDetails;
  }>;
};

function isCurrentlyLive(lsd?: LiveStreamingDetails): boolean {
  if (!lsd?.actualStartTime) return false;
  return !lsd.actualEndTime;
}

/**
 * Détecte un live via la playlist uploads + videos.list (~2 unités)
 * au lieu de search.list (100 unités).
 */
async function fetchLiveViaUploads(
  key: string,
  uploadsPlaylistId: string,
): Promise<YoutubeLiveStream | null> {
  const plUrl = youtubeUrl("playlistItems", key, {
    part: "snippet",
    playlistId: uploadsPlaylistId,
    maxResults: "8",
  });
  const pl = await fetchYoutubeJson<PlaylistItemsResponse>(plUrl, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!pl.ok) return null;

  const rows = pl.data.items ?? [];
  const ids = rows
    .map((r) => r.snippet?.resourceId?.videoId)
    .filter((v): v is string => Boolean(v));
  if (ids.length === 0) return null;

  const titlesById = new Map<string, string>();
  for (const row of rows) {
    const id = row.snippet?.resourceId?.videoId;
    const title = row.snippet?.title;
    if (id && title) titlesById.set(id, title);
  }

  const vidUrl = youtubeUrl("videos", key, {
    part: "snippet,liveStreamingDetails",
    id: ids.join(","),
  });
  const vid = await fetchYoutubeJson<VideosResponse>(vidUrl, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!vid.ok) return null;

  for (const item of vid.data.items ?? []) {
    if (!isCurrentlyLive(item.liveStreamingDetails)) continue;
    return {
      videoId: item.id,
      title: item.snippet?.title ?? titlesById.get(item.id) ?? "Live",
    };
  }

  return null;
}

async function fetchYoutubeLiveUncached(): Promise<YoutubeLiveStream | null> {
  const key = youtubeApiKey();
  if (!key) return null;

  const ctx = await getYoutubeChannelContext();
  if (!ctx) return null;

  return fetchLiveViaUploads(key, ctx.uploadsPlaylistId);
}

const getCachedYoutubeLive = unstable_cache(
  fetchYoutubeLiveUncached,
  ["youtube-live", "v4-low-quota"],
  { revalidate: CACHE_SECONDS },
);

/** Retourne le live en cours sur la chaîne configurée, ou null si hors ligne / API absente. */
export async function getYoutubeLiveStream(): Promise<YoutubeLiveStream | null> {
  if (!youtubeApiKey()) return null;
  return getCachedYoutubeLive();
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}
