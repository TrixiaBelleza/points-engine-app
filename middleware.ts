import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

const PUBLIC_EXACT = new Set(["/login", "/api/auth/login", "/api/meta", "/api/meta/health", "/health"]);

/**
 * Origin the client actually requested.
 *
 * `req.url` reports the local bind address (localhost:3001), so behind cloudflared a
 * redirect built from it sends the browser to https://localhost:3001, which fails TLS.
 * The Host header carries the real hostname, and the scheme comes from the proxy.
 */
function requestOrigin(req: NextRequest): string {
  const host = req.headers.get("host");
  if (!host) return req.nextUrl.origin;
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || req.nextUrl.protocol.replace(":", "") || "http";
  return `${proto}://${host}`;
}

function redirectTo(path: string, req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(path, requestOrigin(req)));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_EXACT.has(pathname);

  if (pathname === "/login" && session) {
    return redirectTo("/members", req);
  }

  if (isPublic) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return redirectTo("/login", req);
  }

  if (pathname === "/") {
    return redirectTo("/members", req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
