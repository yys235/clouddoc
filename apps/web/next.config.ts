import path from 'node:path';

import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

const repoRoot = path.resolve(__dirname, '../..');
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    CLOUDDOC_API_BASE_URL:
      process.env.CLOUDDOC_API_BASE_URL ?? 'http://127.0.0.1:8000/api',
    NEXT_PUBLIC_CLOUDDOC_API_BASE_URL:
      process.env.NEXT_PUBLIC_CLOUDDOC_API_BASE_URL ??
      process.env.CLOUDDOC_API_BASE_URL ??
      'http://127.0.0.1:8000/api',
  },
};

export default nextConfig;
