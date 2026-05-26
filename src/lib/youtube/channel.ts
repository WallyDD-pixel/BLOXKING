import { unstable_cache } from "next/cache";
import { youtubeApiKey, youtubeChannelHandle } from "@/lib/youtube/config";
import { fetchYoutubeJson, youtubeUrl } from "@/lib/youtube/fetch";

export type YoutubeChannelContext = {
  channelId: string;
  uploadsPlaylistId: string;
};

/** La chaîne change rarement — cache long pour économiser le quota (1 unité / appel). */
const CHANNEL_CACHE_SECONDS = 60 * 60;

async function fetchChannelContextUncached(): Promise<YoutubeChannelContext | null> {
  const key = youtubeApiKey();
  if (!key) return null;

  const url = youtubeUrl("channels", key, {
    part: "id,contentDetails",
    forHandle: youtubeChannelHandle(),
  });
  const json = await fetchYoutubeJson<{
    items?: Array<{
      id: string;
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  }>(url, { next: { revalidate: CHANNEL_CACHE_SECONDS } });

  if (!json.ok) return null;

  const item = json.data.items?.[0];
  const uploads = item?.contentDetails?.relatedPlaylists?.uploads;
  if (!item?.id || !uploads) return null;

  return { channelId: item.id, uploadsPlaylistId: uploads };
}

const getCachedChannelContext = unstable_cache(
  fetchChannelContextUncached,
  ["youtube-channel", "v1"],
  { revalidate: CHANNEL_CACHE_SECONDS },
);

export async function getYoutubeChannelContext(): Promise<YoutubeChannelContext | null> {
  if (!youtubeApiKey()) return null;
  return getCachedChannelContext();
}
