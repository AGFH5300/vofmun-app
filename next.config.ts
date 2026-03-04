import type { NextConfig } from 'next';

const explicitDevOrigin = process.env.NEXT_ALLOWED_DEV_ORIGIN;

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    '*.replit.dev',
    '*.sisko.replit.dev',
    ...(explicitDevOrigin ? [explicitDevOrigin] : []),
  ],
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
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
