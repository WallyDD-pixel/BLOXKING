type NextFetchInit = RequestInit & { next?: { revalidate?: number | false } };

export async function fetchYoutubeJson<T>(
  url: URL,
  init?: NextFetchInit,
): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      if (process.env.NODE_ENV !== "production") {
        let body = "";
        try {
          body = (await res.text()).slice(0, 800);
        } catch {
          /* ignore */
        }
        // eslint-disable-next-line no-console
        console.warn("[youtube] API erreur", {
          status: res.status,
          path: `${url.pathname}${url.search ? "?" + url.searchParams.toString().replace(/key=[^&]+/gi, "key=***") : ""}`,
          bodyPreview: body,
        });
      }
      return { ok: false };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[youtube] erreur réseau", url.pathname);
    }
    return { ok: false };
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
