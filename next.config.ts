import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Images légères via actions ; vidéos passent par /api/dispute-evidence/upload
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
