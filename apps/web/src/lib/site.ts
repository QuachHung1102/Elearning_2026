export const SITE_OWNER = {
  name: "E-learning",
} as const;

/** What a page's Open Graph block repeats: a page that sets `openGraph` replaces the layout's whole object. */
export const OPEN_GRAPH_DEFAULTS = {
  siteName: SITE_OWNER.name,
  locale: "vi_VN",
} as const;

/** This site's own origin: canonical links, the sitemap and structured data all name it. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/** The API as the Next server reaches it (rewrites and server-side fetches). */
export const API_ORIGIN = (
  process.env.API_ORIGIN ?? "http://localhost:3001"
).replace(/\/$/, "");
