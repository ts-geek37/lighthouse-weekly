import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lighthouse uses import.meta and dynamic requires that webpack can't bundle.
  // Mark it as external so Next.js doesn't try to bundle it — it runs server-side only.
  serverExternalPackages: ['lighthouse', 'chrome-launcher'],

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
