import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/play";
  // Supabase OAuth callback supprimé. On garde la route pour compat,
  // mais elle redirige vers la connexion.
  return NextResponse.redirect(`${origin}/connexion?next=${encodeURIComponent(next)}`);
}
