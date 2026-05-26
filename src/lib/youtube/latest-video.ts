import { unstable_cache } from "next/cache";
import { fetchYoutubeJson, youtubeUrl } from "@/lib/youtube/fetch";

export type YoutubeLatestVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
};

const CACHE_SECONDS = 10 * 60;

/** Durée min pour une « vraie » vidéo (Shorts ≤ ~3 min, souvent < 2 min). */
const MIN_REGULAR_VIDEO_SECONDS = 120;

function apiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key || key === "ta_cle" || key === "ta_cle_api_google") return null;
  return key;
}

function channelHandle(): string {
  return (process.env.YOUTUBE_CHANNEL_HANDLE ?? "warrenoff").replace(/^@/, "");
}

type SearchItem = {
  id: { videoId?: string };
  snippet: {
    title: string;
    publishedAt: string;
    thumbnails?: Record<string, { url: string }>;
  };
};

type ChannelDetailResponse = {
  items?: Array<{
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
};

type PlaylistItemsResponse = {
  items?: Array<{
    snippet?: {
      title?: string;
      publishedAt?: string;
      resourceId?: { videoId?: string };
      thumbnails?: Record<string, { url: string }>;
    };
  }>;
};

type SearchResponse = {
  items?: SearchItem[];
};

type VideoDetail = {
  seconds: number | null;
  isLive: boolean;
  tags: string[];
};

type VideosResponse = {
  items?: Array<{
    id: string;
    snippet?: { tags?: string[] };
    contentDetails?: { duration?: string };
    liveStreamingDetails?: unknown;
  }>;
};

async function fetchUploadsPlaylistId(
  key: string,
  handle: string,
): Promise<string | null> {
  const url = youtubeUrl("channels", key, {
    part: "contentDetails",
    forHandle: handle,
  });
  const json = await fetchYoutubeJson<ChannelDetailResponse>(url, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!json.ok) return null;
  return json.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

function mapPlaylistItemsToCandidates(
  resp: PlaylistItemsResponse,
): SearchItem[] {
  const out: SearchItem[] = [];
  for (const row of resp.items ?? []) {
    const vid = row.snippet?.resourceId?.videoId;
    const title = row.snippet?.title;
    const publishedAt = row.snippet?.publishedAt;
    if (!vid || title === undefined || !publishedAt) continue;
    out.push({
      id: { videoId: vid },
      snippet: {
        title,
        publishedAt,
        thumbnails: row.snippet?.thumbnails,
      },
    });
  }
  return out;
}

async function fetchCandidatesFromUploadsPlaylist(
  key: string,
  playlistId: string,
): Promise<SearchItem[]> {
  const url = youtubeUrl("playlistItems", key, {
    part: "snippet",
    playlistId,
    maxResults: "50",
  });
  const json = await fetchYoutubeJson<PlaylistItemsResponse>(url, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!json.ok) return [];
  return mapPlaylistItemsToCandidates(json.data);
}

/** Fallback si la playlist uploads échoue (quota / chaîne très récente). */
async function fetchCandidatesViaSearch(
  key: string,
  channelId: string,
): Promise<SearchItem[]> {
  // medium = 4–20 min, long = >20 min → exclut les Shorts et clips très courts
  for (const duration of ["medium", "long"] as const) {
    const url = youtubeUrl("search", key, {
      part: "snippet",
      channelId,
      order: "date",
      type: "video",
      videoDuration: duration,
      maxResults: "10",
    });
    const json = await fetchYoutubeJson<SearchResponse>(url, {
      next: { revalidate: CACHE_SECONDS },
    });
    if (json.ok && (json.data.items?.length ?? 0) > 0) {
      return json.data.items ?? [];
    }
  }
  return [];
}

function pickThumbUrl(item: SearchItem): string | null {
  const t = item.snippet.thumbnails ?? {};
  return (
    t.maxres?.url ??
    t.standard?.url ??
    t.high?.url ??
    t.medium?.url ??
    t.default?.url ??
    null
  );
}

function parseIso8601DurationSeconds(duration?: string): number | null {
  if (!duration) return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = m[2] ? Number(m[2]) : 0;
  const s = m[3] ? Number(m[3]) : 0;
  return h * 3600 + min * 60 + s;
}

async function resolveChannelIdForSearch(
  key: string,
  handle: string,
): Promise<string | null> {
  const url = youtubeUrl("channels", key, { part: "id", forHandle: handle });
  const json = await fetchYoutubeJson<{ items?: { id: string }[] }>(url, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!json.ok) return null;
  return json.data.items?.[0]?.id ?? null;
}

function looksLikeShort(title: string, tags: string[]): boolean {
  const t = title.toLowerCase();
  if (/#shorts?\b/.test(t)) return true;
  if (/\bshorts\b/.test(t) && t.length < 80) return true;
  return tags.some((tag) => {
    const x = tag.toLowerCase();
    return x === "shorts" || x === "short" || x === "youtubeshorts";
  });
}

function isRegularVideo(
  title: string,
  detail: VideoDetail | undefined,
): boolean {
  if (!detail || detail.isLive) return false;
  if (detail.seconds === null) return false;
  if (detail.seconds < MIN_REGULAR_VIDEO_SECONDS) return false;
  if (looksLikeShort(title, detail.tags)) return false;
  return true;
}

async function fetchVideoDetails(
  key: string,
  videoIds: string[],
): Promise<Map<string, VideoDetail>> {
  const map = new Map<string, VideoDetail>();
  if (videoIds.length === 0) return map;

  const chunkSize = 50;
  for (let i = 0; i < videoIds.length; i += chunkSize) {
    const chunk = videoIds.slice(i, i + chunkSize);
    const url = youtubeUrl("videos", key, {
      part: "snippet,contentDetails,liveStreamingDetails",
      id: chunk.join(","),
    });
    const json = await fetchYoutubeJson<VideosResponse>(url, {
      next: { revalidate: CACHE_SECONDS },
    });
    if (!json.ok) continue;
    for (const item of json.data.items ?? []) {
      map.set(item.id, {
        seconds: parseIso8601DurationSeconds(item.contentDetails?.duration),
        isLive: Boolean(item.liveStreamingDetails),
        tags: item.snippet?.tags ?? [],
      });
    }
  }
  return map;
}

async function fetchLatestVideoUncached(): Promise<YoutubeLatestVideo | null> {
  const key = apiKey();
  if (!key) return null;

  const handle = channelHandle();

  let candidates: SearchItem[] = [];

  const uploadsId = await fetchUploadsPlaylistId(key, handle);
  if (uploadsId) {
    candidates = await fetchCandidatesFromUploadsPlaylist(key, uploadsId);
  }

  if (candidates.length === 0) {
    const channelId = await resolveChannelIdForSearch(key, handle);
    if (channelId) {
      candidates = await fetchCandidatesViaSearch(key, channelId);
    }
  }

  const ids = candidates
    .map((c) => c.id.videoId)
    .filter((v): v is string => Boolean(v));

  const details = await fetchVideoDetails(key, ids);

  for (const item of candidates) {
    const videoId = item.id.videoId;
    if (!videoId) continue;

    const title = item.snippet.title;
    if (!isRegularVideo(title, details.get(videoId))) continue;

    return {
      videoId,
      title,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: pickThumbUrl(item),
    };
  }

  return null;
}

const getCachedLatestVideo = unstable_cache(
  fetchLatestVideoUncached,
  ["youtube-latest-video", "v3-prod"],
  { revalidate: CACHE_SECONDS },
);

/** Dernière vidéo "normale" (pas short), ou null si indisponible. */
export async function getYoutubeLatestVideo(): Promise<YoutubeLatestVideo | null> {
  if (!apiKey()) return null;
  return getCachedLatestVideo();
}
