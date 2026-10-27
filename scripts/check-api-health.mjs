#!/usr/bin/env node
/**
 * Starts the built API against the configured PostgreSQL and Redis, calls the
 * readiness probe, and fails unless both dependencies report "up".
 *
 * Run after `npm run build:api`:
 *   npm run check:api-health
 *
 * The API is started on HEALTHCHECK_PORT (default 4177) so it does not collide
 * with a development server on port 4000.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = Number(process.env.HEALTHCHECK_PORT || 4177);
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/v1/health`;
const ENTRYPOINT = 'apps/api/dist/main.js';
const STARTUP_TIMEOUT_MS = 30_000;

if (!existsSync(ENTRYPOINT)) {
  console.error(
    `Missing ${ENTRYPOINT}. Run "npm run build:api" before the health check.`,
  );
  process.exit(1);
}

const child = spawn(process.execPath, [ENTRYPOINT], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

function fail(message) {
  console.error(message);
  if (output.trim()) {
    console.error('\n--- API output ---\n' + output.trim());
  }
  process.exitCode = 1;
}

async function waitForHealth() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastResult = 'no response';

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `API exited with code ${child.exitCode} before becoming healthy.`,
      );
    }

    try {
      const response = await fetch(HEALTH_URL);
      const body = await response.json().catch(() => null);

      if (
        response.status === 200 &&
        body?.status === 'ok' &&
        body?.checks?.database?.status === 'up' &&
        body?.checks?.redis?.status === 'up'
      ) {
        return body;
      }

      lastResult = `HTTP ${response.status}: ${JSON.stringify(body)}`;
    } catch (error) {
      lastResult = error instanceof Error ? error.message : String(error);
    }

    await delay(500);
  }

  throw new Error(
    `API did not become healthy within ${STARTUP_TIMEOUT_MS / 1000}s. Last result: ${lastResult}`,
  );
}

try {
  const report = await waitForHealth();
  console.log(
    `Health check passed: database=${report.checks.database.status} (${report.checks.database.latencyMs}ms), redis=${report.checks.redis.status} (${report.checks.redis.latencyMs}ms).`,
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  child.kill('SIGTERM');
  await delay(2_000);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}
