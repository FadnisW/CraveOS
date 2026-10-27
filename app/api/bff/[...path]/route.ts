import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin Backend-for-Frontend.
 *
 * The browser never holds an access token and never talks to the NestJS API
 * directly. It calls `/api/bff/*`; this handler attaches the httpOnly session
 * cookie as a Bearer token, forwards the request, and strips any token from
 * the response. That removes the XSS token-theft path that localStorage had.
 *
 * Security properties enforced here:
 *  - an explicit allowlist of API roots, so this cannot become an open proxy;
 *  - same-origin checks for unsafe methods (CSRF);
 *  - no caching of authenticated responses;
 *  - logout clears the cookie only after the API revokes the token id.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Host-eatclub_session'
    : 'eatclub_session';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const ALLOWED_ROOTS = new Set([
  'addresses',
  'admin',
  'auth',
  'brand-ops',
  'catalog',
  'hub-ops',
  'logistics',
  'membership',
  'orders',
  'payments',
  'pricing',
  'referrals',
  'riders',
  'tickets',
]);

/** Responses from these paths may contain a freshly signed access token. */
const TOKEN_RESPONSE_PATHS = new Set(['auth/verify-otp', 'riders/verify-otp']);

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function apiBase(): string {
  const raw =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000/api/v1';
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

function configuredOrigins(): string[] {
  return (process.env.NEXT_PUBLIC_APP_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function requestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '');
  return `${protocol}://${request.nextUrl.host}`;
}

function isAllowedOrigin(request: NextRequest, origin: string): boolean {
  const normalised = origin.replace(/\/+$/, '');
  return (
    normalised === requestOrigin(request) ||
    configuredOrigins().includes(normalised)
  );
}

/**
 * Rejects cross-site state changes. `Origin` is mandatory for unsafe methods:
 * browsers send it on every same-origin POST/PATCH/DELETE, and non-browser
 * clients (smoke tests, scripts) can set it explicitly.
 */
function csrfFailure(request: NextRequest): string | null {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return null;

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return 'Cross-site requests are not allowed';
  }

  const origin = request.headers.get('origin');
  if (!origin || !isAllowedOrigin(request, origin)) {
    return 'Request origin is not allowed';
  }

  return null;
}

function decodeTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'),
    );
    if (typeof payload?.exp === 'number') {
      const remaining = payload.exp - Math.floor(Date.now() / 1000);
      return Math.max(0, Math.min(SESSION_MAX_AGE_SECONDS, remaining));
    }
  } catch {
    // Fall through to the default; the API still enforces the real expiry.
  }
  return SESSION_MAX_AGE_SECONDS;
}

function applySessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: decodeTokenExpiry(token),
  });
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

function harden(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Vary', 'Cookie');
  return response;
}

function jsonError(status: number, message: string) {
  return harden(NextResponse.json({ message }, { status }));
}

function anonymousSession() {
  return { authenticated: false, role: null, user: null };
}

async function forward(
  request: NextRequest,
  path: string[],
  token: string | null,
) {
  const joined = path.join('/');
  const headers = new Headers();
  headers.set('accept', 'application/json');

  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);

  if (token) headers.set('authorization', `Bearer ${token}`);

  // Forward the browser address so per-IP OTP limits see the customer, not
  // the Next server. Browsers cannot set this header themselves.
  const forwardedFor =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

  const method = request.method.toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await request.text();

  const upstreamPath = path.map(encodeURIComponent).join('/');
  const query = request.nextUrl.search || '';

  const upstream = await fetch(`${apiBase()}/${upstreamPath}${query}`, {
    method,
    headers,
    body,
    cache: 'no-store',
    redirect: 'manual',
  });

  const text = await upstream.text();
  const upstreamType = upstream.headers.get('content-type') || '';

  if (!upstreamType.includes('application/json')) {
    return {
      status: upstream.status,
      data: null,
      text,
      token: null,
      ok: upstream.ok,
      joined,
      isJson: false,
    };
  }

  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return {
        status: 502,
        data: null,
        text: 'The API returned malformed JSON.',
        token: null,
        ok: false,
        joined,
        isJson: false,
      };
    }
  }

  let freshToken: string | null = null;
  if (
    data &&
    typeof data === 'object' &&
    typeof data.accessToken === 'string' &&
    TOKEN_RESPONSE_PATHS.has(joined)
  ) {
    freshToken = data.accessToken;
    delete data.accessToken;
  }

  return {
    status: upstream.status,
    data,
    text,
    token: freshToken,
    ok: upstream.ok,
    joined,
    isJson: true,
  };
}

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;

  if (!Array.isArray(path) || path.length === 0) {
    return jsonError(404, 'Not found');
  }

  if (path.some((segment) => !segment || segment === '.' || segment === '..')) {
    return jsonError(400, 'Invalid request path');
  }

  if (!ALLOWED_ROOTS.has(path[0])) {
    return jsonError(404, 'Not found');
  }

  const joined = path.join('/');
  const isSession = joined === 'auth/session';
  const isLogout = joined === 'auth/logout';

  const csrfError = csrfFailure(request);
  if (csrfError) {
    return jsonError(403, csrfError);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value || null;

  // Anonymous hydration must not hit the API or log a 401.
  if (isSession && !token) {
    return harden(NextResponse.json(anonymousSession()));
  }

  let result: Awaited<ReturnType<typeof forward>>;
  try {
    result = await forward(request, path, token);
  } catch {
    return jsonError(
      502,
      'The ordering service is unreachable. Please try again.',
    );
  }

  // Session: never surface a 401 to the storefront. A rejected token means
  // "signed out" and the stale cookie is removed.
  if (isSession) {
    if (result.status === 401 || result.status === 403) {
      const response = harden(NextResponse.json(anonymousSession()));
      if (token) clearSessionCookie(response);
      return response;
    }

    if (!result.ok) {
      return jsonError(
        result.status >= 500 ? 503 : result.status,
        result.data?.message || 'Could not verify the session.',
      );
    }

    const response = harden(
      NextResponse.json(result.data ?? anonymousSession()),
    );
    if (result.data?.authenticated === false && token) {
      clearSessionCookie(response);
    }
    return response;
  }

  // Logout: clear the cookie only when the API confirmed the revocation (or
  // the token was already invalid). If the API is down, say so instead of
  // pretending the session ended.
  if (isLogout) {
    if (!result.ok && result.status !== 401) {
      return jsonError(
        result.status >= 500 ? 503 : result.status,
        result.data?.message || 'Could not sign out. Please try again.',
      );
    }

    const response = harden(NextResponse.json({ success: true }));
    clearSessionCookie(response);
    return response;
  }

  if (result.status === 204) {
    const response = new NextResponse(null, { status: 204 });
    if (result.token) applySessionCookie(response, result.token);
    return harden(response);
  }

  if (!result.isJson) {
    const response = new NextResponse(result.text, {
      status: result.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
    return harden(response);
  }

  const response = NextResponse.json(result.data ?? null, {
    status: result.status,
  });

  if (result.token) applySessionCookie(response, result.token);

  return harden(response);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, context);
}
