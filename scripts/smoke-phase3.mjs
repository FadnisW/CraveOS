#!/usr/bin/env node
/**
 * Phase 3 authentication smoke test.
 *
 * Proves, against a running Next server and API:
 *
 *   anonymous session hydration -> CSRF rejection -> OTP cooldown
 *   -> wrong-code lockout -> sign-in sets an httpOnly cookie
 *   -> no token in the response body -> authenticated session
 *   -> unauthenticated 401 -> WebSocket ticket rejected on HTTP
 *   -> logout revokes the token id -> the old token is dead at the API.
 *
 * Requirements:
 *   - Next dev/prod server on http://localhost:3000 (SMOKE_APP_URL)
 *   - API on http://localhost:4000 (SMOKE_API_URL)
 *   - NODE_ENV=development and DEV_OTP_BYPASS=true (the 123456 bypass)
 *
 * The script creates two throwaway customers and sends at most one OTP email.
 * It never touches existing customers.
 *
 * Run: npm run check:auth-smoke
 */

import { io } from 'socket.io-client';

const APP = (process.env.SMOKE_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const API = (
  process.env.SMOKE_API_URL || 'http://localhost:4000/api/v1'
).replace(/\/+$/, '');
const SOCKET_ORIGIN = API.replace(/\/api\/v1$/, '');
const BFF = `${APP}/api/bff`;
const RUN = Date.now().toString(36);
const LOCK_EMAIL = `phase3-lock-${RUN}@example.com`;
const USER_EMAIL = `phase3-user-${RUN}@example.com`;

const results = [];
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    results.push({ name, ok: false, detail });
    console.log(`  FAIL  ${name}`);
    if (detail !== undefined) {
      console.log(`        ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
  }
}

function setCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const raw = response.headers.get('set-cookie');
  return raw ? [raw] : [];
}

async function parse(response) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return {
    status: response.status,
    json,
    text,
    headers: response.headers,
    cookies: setCookies(response),
  };
}

async function bff(method, path, { cookie, body, origin = APP, headers } = {}) {
  const requestHeaders = {
    ...(body ? { 'content-type': 'application/json' } : {}),
    ...(cookie ? { cookie } : {}),
    ...(origin ? { origin } : {}),
    ...(headers || {}),
  };

  const response = await fetch(`${BFF}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  return parse(response);
}

async function api(method, path, { token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parse(response);
}

/**
 * Attempts a real Socket.IO handshake and resolves with whether it connected.
 * The gateway closes rejected sockets, so `connect_error` is the expected
 * result for a long-lived API token.
 */
function trySocket(token, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = io(SOCKET_ORIGIN, {
      transports: ['websocket'],
      reconnection: false,
      timeout: timeoutMs,
      auth: { token },
    });

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.disconnect();
      resolve(result);
    };

    socket.on('connect', () => {
      // The transport connects before the gateway finishes authenticating.
      // Give a rejected handshake time to emit `unauthorized`/`disconnect`.
      setTimeout(() => {
        if (socket.connected) finish({ connected: true });
      }, 500);
    });
    socket.on('unauthorized', (payload) =>
      finish({
        connected: false,
        message: payload?.message || 'unauthorized',
      }),
    );
    socket.on('connect_error', (error) =>
      finish({ connected: false, message: error?.message || 'connect_error' }),
    );
    socket.on('disconnect', (reason) =>
      finish({ connected: false, message: String(reason) }),
    );

    setTimeout(
      () => finish({ connected: false, message: 'handshake timed out' }),
      timeoutMs + 1000,
    );
  });
}

async function main() {
  console.log('CraveOS Phase 3 auth smoke');
  console.log(`  app: ${APP}`);
  console.log(`  api: ${API}\n`);

  const health = await api('GET', '/health');
  check(
    'API health is up',
    health.status === 200 && health.json?.status === 'ok',
    health.json,
  );

  // ---------------------------------------------------------------- session
  const anonymous = await bff('GET', '/auth/session', { origin: null });
  check('anonymous session returns 200', anonymous.status === 200, anonymous.status);
  check(
    'anonymous session is explicitly signed out',
    anonymous.json?.authenticated === false && anonymous.json?.user === null,
    anonymous.json,
  );
  check(
    'session response is not cacheable',
    String(anonymous.headers.get('cache-control') || '').includes('no-store'),
    anonymous.headers.get('cache-control'),
  );
  check(
    'session response is nosniff',
    anonymous.headers.get('x-content-type-options') === 'nosniff',
    anonymous.headers.get('x-content-type-options'),
  );

  // ------------------------------------------------------------------- CSRF
  const evilOrigin = await bff('POST', '/auth/request-otp', {
    body: { email: LOCK_EMAIL },
    origin: 'https://evil.example',
  });
  check(
    'cross-origin POST is rejected with 403',
    evilOrigin.status === 403,
    evilOrigin.json,
  );

  const crossSite = await bff('POST', '/auth/request-otp', {
    body: { email: LOCK_EMAIL },
    headers: { 'sec-fetch-site': 'cross-site' },
  });
  check(
    'Sec-Fetch-Site: cross-site is rejected with 403',
    crossSite.status === 403,
    crossSite.json,
  );

  // -------------------------------------------------------------- OTP limits
  const firstOtp = await bff('POST', '/auth/request-otp', {
    body: { email: LOCK_EMAIL },
  });
  check('OTP request succeeds', firstOtp.status === 200, firstOtp.json);
  check(
    'DEV_OTP_BYPASS is active (demo code returned)',
    typeof firstOtp.json?.demoOtp === 'string',
    firstOtp.json,
  );

  const resend = await bff('POST', '/auth/request-otp', {
    body: { email: LOCK_EMAIL },
  });
  check(
    'immediate resend is throttled with 429',
    resend.status === 429,
    resend.json,
  );

  let wrongCodes = 0;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const wrong = await bff('POST', '/auth/verify-otp', {
      body: { email: LOCK_EMAIL, code: '000000' },
    });
    if (wrong.status === 401) wrongCodes += 1;
  }
  check(
    'five wrong codes are rejected with 401',
    wrongCodes === 5,
    { wrongCodes },
  );

  const locked = await bff('POST', '/auth/verify-otp', {
    body: { email: LOCK_EMAIL, code: '123456' },
  });
  check(
    'verification is locked with 429 after five failures',
    locked.status === 429,
    locked.json,
  );

  // -------------------------------------------------------------- sign-in
  const signIn = await bff('POST', '/auth/verify-otp', {
    body: { email: USER_EMAIL, code: '123456' },
  });
  check('sign-in succeeds', signIn.status === 200, signIn.json);
  check(
    'sign-in returns the user profile',
    signIn.json?.user?.email === USER_EMAIL,
    signIn.json,
  );
  check(
    'access token is absent from the response body',
    !JSON.stringify(signIn.json || {}).includes('accessToken'),
    signIn.json,
  );

  const sessionCookie = signIn.cookies.find((cookie) =>
    cookie.startsWith('eatclub_session='),
  );
  check('sign-in sets the session cookie', !!sessionCookie, signIn.cookies);

  if (!sessionCookie) {
    throw new Error('Cannot continue without a session cookie');
  }

  const cookieHeader = sessionCookie.split(';')[0];
  const token = cookieHeader.slice('eatclub_session='.length);
  const cookieAttributes = sessionCookie.toLowerCase();
  const isHttps = APP.startsWith('https://');

  check('session cookie is HttpOnly', cookieAttributes.includes('httponly'));
  check(
    'session cookie is SameSite=Lax',
    cookieAttributes.includes('samesite=lax'),
  );
  check('session cookie path is /', cookieAttributes.includes('path=/'));
  check(
    isHttps
      ? 'session cookie is Secure over HTTPS'
      : 'session cookie omits Secure on plain HTTP',
    isHttps ? cookieAttributes.includes('secure') : !cookieAttributes.includes('secure'),
  );

  const authenticated = await bff('GET', '/auth/session', {
    cookie: cookieHeader,
    origin: null,
  });
  check(
    'authenticated session hydrates the user',
    authenticated.status === 200 &&
      authenticated.json?.authenticated === true &&
      authenticated.json?.user?.email === USER_EMAIL,
    authenticated.json,
  );
  check(
    'authenticated session does not leak a token',
    !JSON.stringify(authenticated.json || {}).includes('accessToken'),
    authenticated.json,
  );

  // ------------------------------------------------------------- protected API
  const meAnonymous = await bff('GET', '/auth/me', { origin: null });
  check(
    'unauthenticated /auth/me is a 401',
    meAnonymous.status === 401,
    meAnonymous.json,
  );

  const me = await bff('GET', '/auth/me', {
    cookie: cookieHeader,
    origin: null,
  });
  check(
    'authenticated /auth/me returns the same account',
    me.status === 200 && me.json?.user?.email === USER_EMAIL,
    me.json,
  );

  // ----------------------------------------------------------- socket ticket
  const wsTicket = await bff('POST', '/auth/ws-ticket', {
    cookie: cookieHeader,
    body: {},
  });
  check(
    'socket ticket is issued',
    wsTicket.status === 200 && typeof wsTicket.json?.ticket === 'string',
    wsTicket.json,
  );

  const ticketOnHttp = await api('GET', '/auth/me', {
    token: wsTicket.json?.ticket,
  });
  check(
    'socket ticket is rejected on an HTTP route',
    ticketOnHttp.status === 401,
    ticketOnHttp.json,
  );

  const socketWithTicket = await trySocket(wsTicket.json?.ticket);
  check(
    'socket ticket opens a live connection',
    socketWithTicket.connected,
    socketWithTicket.message,
  );

  const socketWithSessionToken = await trySocket(token);
  check(
    'long-lived session token is rejected by the socket gateway',
    !socketWithSessionToken.connected,
    socketWithSessionToken.message,
  );

  // ---------------------------------------------------------------- sign-out
  const logout = await bff('POST', '/auth/logout', {
    cookie: cookieHeader,
    body: {},
  });
  check('logout succeeds', logout.status === 200, logout.json);
  check(
    'logout clears the session cookie',
    logout.cookies.some(
      (cookie) =>
        cookie.startsWith('eatclub_session=') &&
        /max-age=0/i.test(cookie),
    ),
    logout.cookies,
  );

  const revoked = await api('GET', '/auth/me', { token });
  check(
    'the signed-out token is rejected by the API',
    revoked.status === 401,
    revoked.json,
  );

  const staleSession = await bff('GET', '/auth/session', {
    cookie: cookieHeader,
    origin: null,
  });
  check(
    'a stale cookie no longer hydrates a session',
    staleSession.status === 200 &&
      staleSession.json?.authenticated === false,
    staleSession.json,
  );

  console.log('');
  console.log(
    `${results.length - failed}/${results.length} checks passed`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('');
  console.error(`Phase 3 auth smoke failed: ${error?.message || error}`);
  process.exitCode = 1;
});
