import { type NextRequest, NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";

const SESSION_COOKIE = "bk_session";

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function wantsRscPayload(request: NextRequest): boolean {
  return (
    request.headers.get("rsc") === "1" ||
    (request.headers.get("accept") ?? "").includes("text/x-component")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname)) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token?.trim()) {
      if (wantsRscPayload(request)) {
        const denied = new NextResponse(null, { status: 401 });
        applySecurityHeaders(denied);
        return denied;
      }
      const redirect = NextResponse.redirect(new URL("/", request.url));
      applySecurityHeaders(redirect);
      return redirect;
    }
  }

  const response = NextResponse.next({ request });
  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
