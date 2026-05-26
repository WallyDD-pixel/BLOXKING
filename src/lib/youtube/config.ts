export function youtubeApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key || key === "ta_cle" || key === "ta_cle_api_google") return null;
  return key;
}

export function youtubeChannelHandle(): string {
  return (process.env.YOUTUBE_CHANNEL_HANDLE ?? "warrenoff").replace(/^@/, "");
}
