import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private surfaces: nothing here is useful in an index and /admin is
      // supposed to be unobservable from outside.
      disallow: ["/admin", "/account", "/learn", "/checkout", "/my-courses"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
