import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

const PUBLIC_EXACT = new Set(["/login", "/api/auth/login", "/api/meta", "/api/meta/health"]);

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
    return NextResponse.redirect(new URL("/members", req.url));
  }

  if (isPublic) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/members", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
