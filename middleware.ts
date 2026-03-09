import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set(["/login", "/reset-password"]);

function routeByRole(role: string) {
  if (role === "chair") return "/chair";
  if (role === "admin" || role === "secretariat") return "/admin";
  return "/home";
}

function getUserRoleFromCookie(request: NextRequest) {
  const userCookie = request.cookies.get("user")?.value;

  if (!userCookie) {
    return null;
  }

  try {
    const parsed = JSON.parse(userCookie);
    return typeof parsed?.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const role = getUserRoleFromCookie(request);
  const isAuthenticated = Boolean(role);

  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isPublicRoute) {
    const appUrl = new URL(routeByRole(role!), request.url);
    return NextResponse.redirect(appUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
