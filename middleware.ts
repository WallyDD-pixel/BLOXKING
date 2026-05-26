import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Sans Supabase SSR: pas de refresh automatique à faire ici.
  // On laisse passer; la protection des routes est gérée côté serveur (layouts/actions).
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
