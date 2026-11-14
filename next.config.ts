import type { NextConfig } from 'next';

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
