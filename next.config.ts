// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Other config options can go here if you have them */
  // reactStrictMode: true, // Example if you had other options

  // Add the images configuration:
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '', // Default port
        pathname: '/t/p/**', // Allow any path under /t/p/
      },
      // Add other allowed domains here if needed
    ],
  },
};

export default nextConfig;