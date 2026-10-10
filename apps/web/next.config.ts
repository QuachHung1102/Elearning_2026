import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";
import { internalApiSecret } from "./src/lib/internal-api";
import { API_ORIGIN } from "./src/lib/site";

// Fail the build and the start, not the first request, when it is needed and missing.
internalApiSecret();

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
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
