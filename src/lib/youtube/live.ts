import { unstable_cache } from "next/cache";
import { fetchYoutubeJson, youtubeUrl } from "@/lib/youtube/fetch";

export type YoutubeLiveStream = {
  videoId: string;
  title: string;
};

const CACHE_SECONDS = 60;

function apiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  return key || null;
}

function channelHandle(): string {
  return (process.env.YOUTUBE_CHANNEL_HANDLE ?? "warrenoff").replace(/^@/, "");
}

type ChannelsResponse = {
  items?: { id: string }[];
};

type SearchResponse = {
  items?: {
    id: { videoId?: string };
    snippet: { title: string };
  }[];
};

async function resolveChannelId(key: string, handle: string): Promise<string | null> {
  const url = youtubeUrl("channels", key, {
    part: "id",
    forHandle: handle,
  });
  const json = await fetchYoutubeJson<ChannelsResponse>(url, {
    next: { revalidate: CACHE_SECONDS },
  });
  return json.ok ? json.data.items?.[0]?.id ?? null : null;
}

async function fetchLiveOnChannel(
  key: string,
  channelId: string,
): Promise<YoutubeLiveStream | null> {
  const url = youtubeUrl("search", key, {
    part: "snippet",
    channelId,
    type: "video",
    eventType: "live",
    maxResults: "1",
  });
  const json = await fetchYoutubeJson<SearchResponse>(url, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!json.ok) return null;
  const item = json.data.items?.[0];
  const videoId = item?.id?.videoId;
  if (!videoId) return null;

  return {
    videoId,
    title: item.snippet.title,
  };
}

async function fetchYoutubeLiveUncached(): Promise<YoutubeLiveStream | null> {
  const key = apiKey();
  if (!key) return null;

  const handle = channelHandle();
  const channelId = await resolveChannelId(key, handle);
  if (!channelId) return null;

  return fetchLiveOnChannel(key, channelId);
}

const getCachedYoutubeLive = unstable_cache(
  fetchYoutubeLiveUncached,
  ["youtube-live"],
  { revalidate: CACHE_SECONDS },
);

/** Retourne le live en cours sur la chaîne configurée, ou null si hors ligne / API absente. */
export async function getYoutubeLiveStream(): Promise<YoutubeLiveStream | null> {
  if (!apiKey()) return null;
  return getCachedYoutubeLive();
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}
