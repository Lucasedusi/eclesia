import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
  "/auth/callback",
  "/convite",
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

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const isPublic = matchesPrefix(pathname, PUBLIC_PATHS);
  const isPreparation = matchesPrefix(pathname, PREPARATION_PATHS);

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthEntry =
    pathname === "/login" ||
    pathname === "/cadastro" ||
    pathname === "/recuperar-senha";

  if (user && isAuthEntry) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!user && isPreparation) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
