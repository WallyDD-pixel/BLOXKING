type NextFetchInit = RequestInit & { next?: { revalidate?: number | false } };

export type YoutubeFetchError = {
  status: number;
  message: string;
};

export async function fetchYoutubeJson<T>(
  url: URL,
  init?: NextFetchInit,
): Promise<
  { ok: true; data: T } | { ok: false; error: YoutubeFetchError }
> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      let body = "";
      try {
        body = (await res.text()).slice(0, 800);
      } catch {
        /* ignore */
      }
      let message = body;
      try {
        const parsed = JSON.parse(body) as {
          error?: { message?: string; errors?: { reason?: string }[] };
        };
        message =
          parsed.error?.message ??
          parsed.error?.errors?.[0]?.reason ??
          body;
      } catch {
        /* raw body */
      }
      // eslint-disable-next-line no-console
      console.warn("[youtube] API erreur", {
        status: res.status,
        path: `${url.pathname}${url.search ? "?" + url.searchParams.toString().replace(/key=[^&]+/gi, "key=***") : ""}`,
        bodyPreview: body,
      });
      return { ok: false, error: { status: res.status, message } };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[youtube] erreur réseau", url.pathname, e);
    return {
      ok: false,
      error: {
        status: 0,
        message: e instanceof Error ? e.message : "Erreur réseau",
      },
    };
  }
}

export function youtubeUrl(path: string, key: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("key", key);
  return url;
}
