type Header = { key: string; value: string };

/** One origin, no path and no wildcard: a value that cannot add a directive to the policy. */
const ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d+)?$/;

function parseOrigins(list: string): string[] {
  const origins = list.split(/[\s,]+/).filter(Boolean);
  for (const origin of origins) {
    if (!ORIGIN.test(origin)) {
      throw new Error(
        `CSP_MEDIA_ORIGINS: "${origin}" is not an origin such as https://media.example.com`,
      );
    }
  }
  return origins;
}

/**
 * The response headers every page carries (ROADMAP.md §9, REVIEW F-20).
 *
 * `mediaOrigins` (env `CSP_MEDIA_ORIGINS`) names the hosts images, video, HLS
 * and presigned uploads use when they are not served through this site's own
 * `/api` rewrite: the R2 public URL and upload host, a Cloudflare Stream
 * customer domain. `API_PUBLIC_URL` must be this site's own origin (the
 * browser's, PHASE_2_REPORT §3.6), or the API's media is another origin too.
 *
 * ponytail: scripts and styles allow `'unsafe-inline'` because Next inlines its
 * hydration payload and a per-request nonce would make every page dynamic
 * (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
 * What the policy still stops: scripts from another origin, plugins, a changed
 * `<base>`, forms posting away, framing, and fetches to foreign hosts. Move to
 * nonces or SRI if the Markdown allowlist ever has to be widened.
 */
export function securityHeaders({
  dev,
  mediaOrigins = "",
}: {
  dev: boolean;
  mediaOrigins?: string;
}): Header[] {
  const media = parseOrigins(mediaOrigins);
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' blob: data:", ...media].join(" "),
    ["media-src 'self' blob:", ...media].join(" "),
    "font-src 'self'",
    // The dev server's hot reload talks over a websocket.
    ["connect-src 'self'", ...(dev ? ["ws:"] : []), ...media].join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: policy },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Ignored over plain HTTP, but a developer's HTTPS localhost would stay pinned.
    ...(dev
      ? []
      : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
  ];
}
