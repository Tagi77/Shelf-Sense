import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "development" ? undefined : "export",
  ...(process.env.NODE_ENV === "development"
    ? {
        rewrites: async () => [
          {
            source: "/api/:path*",
            destination: "http://127.0.0.1:5175/api/:path*",
          },
        ],
      }
    : {}),
  images: { unoptimized: true },
  devIndicators: false,
};
export default nextConfig;
