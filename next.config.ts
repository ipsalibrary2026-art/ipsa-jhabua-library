import type { NextConfig } from "next";

// Next.js rejects a bare "*" wildcard for allowedDevOrigins, so list the
// concrete sandbox preview host plus its parent domains explicitly.
const sandboxId = process.env.E2B_SANDBOX_ID;
const devOrigins = [
  ...(sandboxId ? [`4000-${sandboxId}.e2b.app`] : []),
  "**.e2b.app",
  "**.e2b.dev",
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents:false,
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  allowedDevOrigins: devOrigins,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    rules: {
      "*.{jsx,tsx}": {
        condition: { not: 'foreign' },
        loaders: [require.resolve('@ideavo/webpack-tagger')],
      },
    },
  },
} as NextConfig;

export default nextConfig;
