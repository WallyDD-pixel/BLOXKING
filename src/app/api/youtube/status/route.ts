import { getYoutubeApiHealth } from "@/lib/youtube/health";

/** Diagnostic YouTube (prod) — https://bloxking.vercel.app/api/youtube/status */
export async function GET() {
  const health = await getYoutubeApiHealth();
  return Response.json(health, {
    status: health.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
