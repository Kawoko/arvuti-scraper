import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    /**
     * Keep visited pages in the browser's router cache for a short window.
     * Combined with the per-page cache in `lib/browser-cache.ts`, going back to a
     * listing no longer re-downloads the rows it already has. Prices still
     * revalidate on the next request after this window.
     */
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

export default nextConfig;
