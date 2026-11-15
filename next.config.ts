import type { NextConfig } from 'next';
import { publicRealtimeConfiguration } from './lib/configuration';

publicRealtimeConfiguration({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

const nextConfig: NextConfig = {
  // Preserve the request origin on auth redirects, including local loopback IPs.
  skipProxyUrlNormalize: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
    ],
  },
};

export default nextConfig;
