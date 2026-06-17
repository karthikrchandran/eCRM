import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "araglobalinc.com",
        protocol: "https"
      }
    ]
  }
};

export default nextConfig;
