import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
