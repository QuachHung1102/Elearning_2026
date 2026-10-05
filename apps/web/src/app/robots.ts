import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private surfaces: nothing here is useful in an index and /admin is
      // supposed to be unobservable from outside.
      disallow: [
        "/admin",
        "/instructor",
        "/account",
        "/learn",
        "/checkout",
        "/my-courses",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
