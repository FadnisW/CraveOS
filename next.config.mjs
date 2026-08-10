/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is enabled via `next dev --turbopack` in scripts
  reactStrictMode: true,
  experimental: {
    // React 19 is stable in Next.js 15, no need for experimental flag
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
