import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware` → `proxy` (Node runtime, not edge).
 * Refreshes the Supabase auth session on every request so Server Components
 * read fresh tokens, and gates the app behind authentication.
 */

// Routes reachable while signed out.
const PUBLIC_PATHS = ["/login", "/auth"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase not configured yet — keep the app runnable (design showcase, etc).
  if (!url || !anon) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getClaims().
  // getClaims() refreshes the session (via getSession) and, when asymmetric JWT
  // signing keys are enabled, verifies the token locally — no auth round-trip.
  // With legacy HS256 keys it transparently falls back to a getUser() call.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Signed-out users hitting a protected route → send to /login.
  if (!userId && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Signed-in users on /login → send to the dashboard.
  if (userId && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and the API cron routes (which are
     * authenticated by a shared secret, not a user session).
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
