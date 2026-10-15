import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  compiler: {
    styledComponents: true,
  },
  experimental: {
    exposeTestingApiInProductionBuild: process.env.E2E_TESTING === "true",
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  serverExternalPackages: ["exceljs", "@resvg/resvg-js"],
  async headers() {
    const confidential = [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Pragma", value: "no-cache" },
    ];
    return [
      { source: "/financeiro/:path*", headers: confidential },
      { source: "/api/finance/:path*", headers: confidential },
      { source: "/login", headers: confidential },
      {
        source: "/financeiro-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
