import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";
import { isCoachOnlyPath, isPublicPath, playerOwnsProfilePath, playerProfilePath } from "./lib/authPaths";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  if (isPublicPath(pathname)) {
    const user = verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (user && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const user = verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (user.role === "player") {
    if (isCoachOnlyPath(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (!playerOwnsProfilePath(pathname, user.squadPlayerId)) {
      const own = playerProfilePath(user.squadPlayerId) ?? "/";
      return NextResponse.redirect(new URL(own, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
