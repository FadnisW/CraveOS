import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Browser connections allowed by CSP.
 *
 * The storefront only talks to its own BFF for data. The two exceptions are
 * the live order socket (direct WebSocket to the API) and Razorpay Checkout,
 * which loads its own script and iframe.
 */
function connectSources() {
  const sources = new Set([
    "'self'",
    'https://api.razorpay.com',
    'https://checkout.razorpay.com',
    'https://lumberjack.razorpay.com',
  ]);

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (socketUrl) {
    sources.add(socketUrl.replace(/\/+$/, ''));
    try {
      const parsed = new URL(socketUrl);
      sources.add(
        `${parsed.protocol === 'https:' ? 'wss:' : 'ws:'}//${parsed.host}`,
      );
    } catch {
      // An invalid URL is ignored here; the socket simply fails to connect.
    }
  } else if (!isProduction) {
    sources.add('http://localhost:4000');
    sources.add('ws://localhost:4000');
  }

  return [...sources].join(' ');
}

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js hydrates through inline bootstrap scripts. A nonce-based policy
  // needs a request-time proxy; until then `unsafe-inline` is explicit rather
  // than silently absent.
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com${
    isProduction ? '' : " 'unsafe-eval'"
  }`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src ${connectSources()}`,
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isProduction ? 'upgrade-insecure-requests' : '',
]
  .filter(Boolean)
  .join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the Turbopack root to this app. Without it, Next walks up to
  // C:\Users\darks\package-lock.json and ignores files inside the repo.
  turbopack: {
    root: projectRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          ...(isProduction
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains',
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
