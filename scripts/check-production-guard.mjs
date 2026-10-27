#!/usr/bin/env node
/**
 * Proves the production startup guard rejects an unsafe configuration.
 *
 * The API is launched with NODE_ENV=production, an example JWT secret, a
 * localhost CORS origin, and DEV_OTP_BYPASS=true. It must exit non-zero before
 * listening, and the error must name every unsafe setting.
 *
 * Run after `npm run build:api`:
 *   npm run check:prod-guard
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const ENTRYPOINT = 'apps/api/dist/main.js';
const TIMEOUT_MS = 15_000;

if (!existsSync(ENTRYPOINT)) {
  console.error(
    `Missing ${ENTRYPOINT}. Run "npm run build:api" before the guard check.`,
  );
  process.exit(1);
}

const child = spawn(process.execPath, [ENTRYPOINT], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    JWT_SECRET: 'replace-with-a-long-random-string',
    DATABASE_URL: 'postgresql://craveos:craveos@127.0.0.1:5432/craveos',
    REDIS_URL: 'redis://127.0.0.1:6379',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    DEV_OTP_BYPASS: 'true',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

const timer = setTimeout(() => {
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    console.error(
      'Production guard did not reject the unsafe configuration within 15s.',
    );
    console.error(output.trim());
    process.exitCode = 1;
  }
}, TIMEOUT_MS);

child.on('close', (code) => {
  clearTimeout(timer);

  if (code === 0) {
    console.error(
      'Production guard exited successfully. It must reject the unsafe configuration.',
    );
    console.error(output.trim());
    process.exitCode = 1;
    return;
  }

  const requiredMessages = [
    'Invalid environment configuration',
    'JWT_SECRET looks like an example value',
    'DEV_OTP_BYPASS must not be enabled in production',
    'NEXT_PUBLIC_APP_URL',
  ];

  const missing = requiredMessages.filter((message) => !output.includes(message));
  if (missing.length > 0) {
    console.error(
      `Production guard rejected the configuration, but did not report: ${missing.join(', ')}`,
    );
    console.error(output.trim());
    process.exitCode = 1;
    return;
  }

  console.log(
    'Production guard rejected the unsafe configuration and named every problem.',
  );
});
