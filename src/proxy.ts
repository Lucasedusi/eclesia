import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
  "/auth/callback",
  "/convite",
  "/api/cron/documents/cleanup",
  "/api/telemetry/web-vitals",
];

const PREPARATION_PATHS = [
  "/onboarding",
  "/aguardando-liberacao",
  "/acesso-indisponivel",
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function redirectWithSession(url: URL, sessionResponse: NextResponse) {
  const redirect = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  ["cache-control", "expires", "pragma"].forEach((name) => {
    const value = sessionResponse.headers.get(name);
    if (value) redirect.headers.set(name, value);
  });
  return redirect;
}

function finalizeResponse(
  response: NextResponse,
  pathname: string,
  startedAt: number,
) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  const duration = performance.now() - startedAt;
  response.headers.set("Server-Timing", `proxy;dur=${duration.toFixed(1)}`);
  if (process.env.NODE_ENV === "development") {
    console.info(`[performance] proxy ${pathname}: ${duration.toFixed(1)}ms`);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const startedAt = performance.now();
  const { response, authenticated } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const isPublic = matchesPrefix(pathname, PUBLIC_PATHS);
  const isPreparation = matchesPrefix(pathname, PREPARATION_PATHS);

  if (!authenticated && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return finalizeResponse(
      redirectWithSession(loginUrl, response),
      pathname,
      startedAt,
    );
  }

  const isAuthEntry =
    pathname === "/login" ||
    pathname === "/cadastro" ||
    pathname === "/recuperar-senha";

  if (authenticated && isAuthEntry) {
    return finalizeResponse(
      redirectWithSession(new URL("/", request.url), response),
      pathname,
      startedAt,
    );
  }

  if (!authenticated && isPreparation) {
    return finalizeResponse(
      redirectWithSession(new URL("/login", request.url), response),
      pathname,
      startedAt,
    );
  }

  return finalizeResponse(response, pathname, startedAt);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
