import { unstable_cache } from "next/cache";
import { getYoutubeChannelContext } from "@/lib/youtube/channel";
import { youtubeApiKey } from "@/lib/youtube/config";
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

type UploadCandidate = {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
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

function mapPlaylistItems(resp: PlaylistItemsResponse): UploadCandidate[] {
  const out: UploadCandidate[] = [];
  for (const row of resp.items ?? []) {
    const videoId = row.snippet?.resourceId?.videoId;
    const title = row.snippet?.title;
    const publishedAt = row.snippet?.publishedAt;
    if (!videoId || title === undefined || !publishedAt) continue;
    out.push({
      videoId,
      title,
      publishedAt,
      thumbnailUrl: pickThumbUrl(row.snippet?.thumbnails),
    });
  }
  return out;
}

async function fetchCandidatesFromUploadsPlaylist(
  key: string,
  playlistId: string,
): Promise<UploadCandidate[]> {
  const url = youtubeUrl("playlistItems", key, {
    part: "snippet",
    playlistId,
    maxResults: "30",
  });
  const json = await fetchYoutubeJson<PlaylistItemsResponse>(url, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!json.ok) return [];
  return mapPlaylistItems(json.data);
}

function pickThumbUrl(
  thumbnails?: Record<string, { url: string }>,
): string | null {
  const t = thumbnails ?? {};
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

  const url = youtubeUrl("videos", key, {
    part: "snippet,contentDetails,liveStreamingDetails",
    id: videoIds.join(","),
  });
  const json = await fetchYoutubeJson<VideosResponse>(url, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!json.ok) return map;

  for (const item of json.data.items ?? []) {
    map.set(item.id, {
      seconds: parseIso8601DurationSeconds(item.contentDetails?.duration),
      isLive: Boolean(item.liveStreamingDetails),
      tags: item.snippet?.tags ?? [],
    });
  }
  return map;
}

async function fetchLatestVideoUncached(): Promise<YoutubeLatestVideo | null> {
  const key = youtubeApiKey();
  if (!key) return null;

  const ctx = await getYoutubeChannelContext();
  if (!ctx) return null;

  const candidates = await fetchCandidatesFromUploadsPlaylist(
    key,
    ctx.uploadsPlaylistId,
  );
  if (candidates.length === 0) return null;

  const details = await fetchVideoDetails(
    key,
    candidates.map((c) => c.videoId),
  );

  for (const item of candidates) {
    if (!isRegularVideo(item.title, details.get(item.videoId))) continue;
    return {
      videoId: item.videoId,
      title: item.title,
      publishedAt: item.publishedAt,
      thumbnailUrl: item.thumbnailUrl,
    };
  }

  return null;
}

const getCachedLatestVideo = unstable_cache(
  fetchLatestVideoUncached,
  ["youtube-latest-video", "v4-low-quota"],
  { revalidate: CACHE_SECONDS },
);

/** Dernière vidéo "normale" (pas short), ou null si indisponible. */
export async function getYoutubeLatestVideo(): Promise<YoutubeLatestVideo | null> {
  if (!youtubeApiKey()) return null;
  return getCachedLatestVideo();
}
