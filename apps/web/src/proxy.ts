import { NextResponse, type NextRequest } from "next/server";
import { forwardVisitor } from "./lib/internal-api";
import { catalogResource } from "./lib/routes";
import { API_ORIGIN } from "./lib/site";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { unsatisfiableVideoRange } from "./lib/video-range";

/**
 * Every page streams (the root `loading.tsx` wraps them all), so the status is
 * committed to 200 before the page learns that its course or category does not
 * exist. Checking first is Next's documented way to a real 404. Only for full
 * page loads: the status matters to crawlers, while client navigations and
 * prefetches already get the not-found UI and would only double the API calls.
 */
async function catalogStatus(request: NextRequest, resource: string) {
  if (!request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.next();
  }
  // ponytail: one extra API call per page load, cache the answer here if the
  // catalog ever sees real traffic.
  const response = await fetch(`${API_ORIGIN}/api/v1${resource}`, {
    method: "HEAD",
    headers: forwardVisitor(new Headers(), request.headers),
    signal: AbortSignal.timeout(3_000),
  }).catch(() => null);
  // Anything but a clear 404 (API down or slow) is left to the page.
  return response?.status === 404
    ? NextResponse.rewrite(request.nextUrl, { status: 404 })
    : NextResponse.next();
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/videos/books/")) {
    const filename = /^\/videos\/books\/(lesson-0[1-4]\.mp4)$/.exec(request.nextUrl.pathname)?.[1];
    if (filename && request.method === "GET" && request.headers.has("range")) {
      const file = await stat(resolve(process.cwd(), "public/videos/books", filename)).catch(() => null);
      if (file && unsatisfiableVideoRange(request.headers.get("range"), file.size)) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}`, "Accept-Ranges": "bytes" } });
      }
    }
    return NextResponse.next();
  }
  // The `/api/*` rewrite in next.config.ts forwards these request headers.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const headers = forwardVisitor(
      new Headers(request.headers),
      request.headers,
    );
    return NextResponse.next({ request: { headers } });
  }

  const resource = catalogResource(request.nextUrl.pathname);
  if (resource) return catalogStatus(request, resource);

  if (request.cookies.has("elearning_session")) {
    const headers = new Headers(request.headers);
    headers.set(
      "x-elearning-path",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.next({ request: { headers } });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/videos/books/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/api/:path*",
    "/categories/:slug",
    "/checkout/:path*",
    "/courses/:slug",
    "/instructor/:path*",
    "/learn/:path*",
    "/my-courses/:path*",
  ],
};
