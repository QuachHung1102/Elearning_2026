import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const apiOrigin = (process.env.API_ORIGIN ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Not /api: those responses come from the API, which sets its own.
        source: "/((?!api/).*)",
        headers: securityHeaders({
          dev: process.env.NODE_ENV === "development",
          mediaOrigins: process.env.CSP_MEDIA_ORIGINS,
        }),
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
