import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALE_COOKIE, isLocale, negotiateLocale } from "@/lib/i18n/config";
import { contentPathExists, isContentPath } from "@/lib/content-index";

/**
 * 1. Locale detection happens ONLY for paths without a locale prefix (cookie → Accept-Language).
 *    Deep links with /ru or /en are never redirected: the URL is the source of truth.
 * 2. Unknown pose/program/step URLs answer a real 404 before the page starts streaming (src/lib/content-index.ts).
 * 3. Refreshes the Supabase session cookie once per navigation.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (!isLocale(first)) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale) ? cookieLocale : negotiateLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url, 307);
  }

  const segments = pathname.split("/").filter(Boolean);
  if (isContentPath(segments) && !(await contentPathExists(segments))) {
    // Rendered by the localized catch-all page, which calls notFound() before streaming: status 404.
    return NextResponse.rewrite(new URL(`/${first}/__not-found`, request.url));
  }

  let response = NextResponse.next({ request });

  // Only touch auth when a Supabase session cookie is present (keeps anonymous pages cache-friendly).
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (hasAuthCookie && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet, headers) {
            for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
            response = NextResponse.next({ request });
            for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
            for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
          },
        },
      },
    );
    await supabase.auth.getClaims();
  }

  // Remember an explicit locale choice made through the URL.
  if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
    response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: [
    // Skip Next internals, API, auth callbacks, static and media files.
    "/((?!_next/|api/|auth/|media/|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|webp|avif|svg|mp4|webm|woff2|ico|txt|xml)$).*)",
  ],
};
