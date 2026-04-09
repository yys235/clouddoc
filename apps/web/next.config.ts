import path from 'node:path';

import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

const repoRoot = path.resolve(__dirname, '../..');
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    CLOUDDOC_API_BASE_URL:
      process.env.CLOUDDOC_API_BASE_URL ?? '/api',
    NEXT_PUBLIC_CLOUDDOC_API_BASE_URL:
      process.env.NEXT_PUBLIC_CLOUDDOC_API_BASE_URL ??
      process.env.CLOUDDOC_API_BASE_URL ??
      '/api',
  },
  async rewrites() {
    const backendOrigin = process.env.CLOUDDOC_BACKEND_ORIGIN ?? 'http://127.0.0.1:8000';

    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendOrigin}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
