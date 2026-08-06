import type { NextConfig } from 'next';

const explicitDevOrigin = process.env.NEXT_ALLOWED_DEV_ORIGIN;

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    '*.replit.dev',
    '*.sisko.replit.dev',
    '*.pike.replit.dev',
    '16613c55-4621-4024-8bd5-4736100818c7-00-26hnf8y6ovl1a.pike.replit.dev',
    ...(explicitDevOrigin ? [explicitDevOrigin] : []),
  ],
  // Replit's development proxy truncates very large eval-source-map chunks.
  // Keep client chunks compact and valid by disabling inline webpack source maps.
  webpack(config, { dev, isServer }) {
    if (dev && !isServer) {
      config.devtool = false;
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
