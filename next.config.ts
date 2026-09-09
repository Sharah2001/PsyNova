import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  allowedDevOrigins: ["canon-observing-failing.ngrok-free.dev"],
  // Allow access to remote image placeholder.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**", // This allows any path under the hostname
      },
    ],
  },
  serverExternalPackages: [
    "@nestjs/core",
    "@nestjs/common",
    "@nestjs/websockets",
    "@nestjs/microservices",
    "@nestjs/platform-express",
    "@nestjs/typeorm",
    "typeorm",
    "reflect-metadata",
    "sqlite3",
    "better-sqlite3",
    "pg",
  ],
  transpilePackages: ["motion"],
};

export default nextConfig;
