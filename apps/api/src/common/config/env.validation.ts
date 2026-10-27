/**
 * Environment validation and shared connection helpers.
 *
 * The API must fail before it starts listening when a production deployment is
 * missing a real database, Redis, signing secret, or HTTPS origin. Silently
 * falling back to localhost turns a misconfiguration into a security incident.
 */

const EXAMPLE_SECRET_PATTERNS = [
  /replace[-_ ]?with/i,
  /change[-_ ]?me/i,
  /your[-_ ]?(jwt[-_ ]?)?secret/i,
  /example/i,
  /^secret$/i,
  /^password$/i,
  /^dev[-_ ]?secret$/i,
];

const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;

type Env = Record<string, unknown>;

function text(env: Env, key: string): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function isProduction(env: Env): boolean {
  return text(env, 'NODE_ENV') === 'production';
}

function parseOrigins(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean),
    ),
  ];
}

function originProblem(origin: string): string | null {
  let parsed: URL;

  try {
    parsed = new URL(origin);
  } catch {
    return `${origin} is not a valid URL`;
  }

  if (parsed.protocol !== 'https:') {
    return `${origin} must use https`;
  }

  if (parsed.username || parsed.password) {
    return `${origin} must not contain credentials`;
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    return `${origin} must be an origin (scheme + host + port), not a path`;
  }

  if (
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1'
  ) {
    return `${origin} must not point at localhost`;
  }

  return null;
}

/**
 * Passed to `ConfigModule.forRoot({ validate })`.
 *
 * Throws during module construction, so the process never opens a port with an
 * unsafe configuration.
 */
export function validateEnv(config: Env): Env {
  const production = isProduction(config);
  const problems: string[] = [];

  const jwtSecret = text(config, 'JWT_SECRET');
  if (!jwtSecret) {
    problems.push(
      'JWT_SECRET is required. Tokens must never be signed with a fallback secret.',
    );
  } else if (production) {
    if (jwtSecret.length < MIN_PRODUCTION_JWT_SECRET_LENGTH) {
      problems.push(
        `JWT_SECRET must be at least ${MIN_PRODUCTION_JWT_SECRET_LENGTH} characters in production.`,
      );
    }
    if (EXAMPLE_SECRET_PATTERNS.some((pattern) => pattern.test(jwtSecret))) {
      problems.push(
        'JWT_SECRET looks like an example value. Generate a real random secret.',
      );
    }
  }

  const databaseUrl = text(config, 'DATABASE_URL');
  if (!databaseUrl) {
    problems.push('DATABASE_URL is required.');
  } else if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    problems.push('DATABASE_URL must be a postgres:// or postgresql:// URL.');
  }

  const redisUrlValue = text(config, 'REDIS_URL');
  if (!redisUrlValue) {
    problems.push('REDIS_URL is required. OTP storage and kitchen queues need Redis.');
  } else if (!/^rediss?:\/\//i.test(redisUrlValue)) {
    problems.push('REDIS_URL must be a redis:// or rediss:// URL.');
  }

  if (production && text(config, 'DEV_OTP_BYPASS').toLowerCase() === 'true') {
    problems.push(
      'DEV_OTP_BYPASS must not be enabled in production. Every account would accept the bypass code.',
    );
  }

  if (production) {
    const origins = parseOrigins(text(config, 'NEXT_PUBLIC_APP_URL'));
    if (origins.length === 0) {
      problems.push(
        'NEXT_PUBLIC_APP_URL must list at least one explicit HTTPS origin in production.',
      );
    }
    for (const origin of origins) {
      const problem = originProblem(origin);
      if (problem) {
        problems.push(`NEXT_PUBLIC_APP_URL: ${problem}`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n- ${problems.join('\n- ')}`,
    );
  }

  if (!production && text(config, 'DEV_OTP_BYPASS').toLowerCase() === 'true') {
    // Deliberately loud: this bypass accepts one fixed code for every account.
    console.warn(
      '[config] DEV_OTP_BYPASS is enabled. OTP verification is bypassed for every account. Never use this outside local development.',
    );
  }

  return config;
}

/**
 * Browser origins allowed to call the REST API and open WebSocket connections.
 *
 * Development always includes the local storefront. Production relies on the
 * HTTPS origins validated above and never falls back to localhost.
 */
export function corsOrigins(): string[] {
  const configured = parseOrigins(process.env.NEXT_PUBLIC_APP_URL ?? '');

  if (process.env.NODE_ENV !== 'production') {
    return [...new Set(['http://localhost:3000', ...configured])];
  }

  return configured;
}

/** The single Redis connection string. No localhost fallback in any environment. */
export function redisUrl(): string {
  const value = process.env.REDIS_URL?.trim();

  if (!value) {
    throw new Error(
      'REDIS_URL is required. OTP storage and kitchen queues cannot start without Redis.',
    );
  }

  return value;
}

/**
 * Connection options for BullMQ, which does not accept a URL string directly.
 * Username, password and TLS are preserved so a managed Redis instance works.
 */
export function redisConnectionOptions() {
  const parsed = new URL(redisUrl());
  const database = parsed.pathname.replace(/^\//, '');
  const db = database ? Number(database) : NaN;

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(Number.isInteger(db) ? { db } : {}),
    ...(parsed.username
      ? { username: decodeURIComponent(parsed.username) }
      : {}),
    ...(parsed.password
      ? { password: decodeURIComponent(parsed.password) }
      : {}),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
