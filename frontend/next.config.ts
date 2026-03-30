import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "op.onbid.co.kr",
      },
    ],
  },
};

export default nextConfig;
