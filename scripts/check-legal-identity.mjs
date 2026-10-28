#!/usr/bin/env node
/**
 * Legal identity launch gate.
 *
 * A legal page that names the wrong entity, or shows `{{LEGAL_ENTITY_NAME}}` to
 * a customer, is worse than no page at all. This script is the machine check
 * behind the promise:
 *
 *   npm run check:legal            advisory — prints what is missing
 *   npm run check:legal:release    blocking — exits 1 unless every value is real
 *
 * The release workflow runs the blocking form. `npm run verify` runs the
 * advisory form so local development is not blocked while the values are still
 * being collected.
 *
 * Values are read from the environment, with `.env` loaded first when present.
 * The same `NEXT_PUBLIC_*` names are read by `src/lib/legal.ts`, so there is
 * one source of truth for what "configured" means.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

try {
  // Node >= 20.12. Existing environment variables win over .env values.
  process.loadEnvFile?.('.env');
} catch {
  // No .env is normal in CI; the workflow supplies real environment values.
}

const REQUIRE = process.argv.includes('--require');

const FIELDS = [
  {
    env: 'NEXT_PUBLIC_LEGAL_ENTITY_NAME',
    label: 'Registered entity name',
    validate: (value) => value.length >= 2,
    hint: 'The exact registered name, not a trading name or "CraveOS".',
  },
  {
    env: 'NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS',
    label: 'Registered address',
    validate: (value) => value.length >= 10,
    hint: 'The full address shown on the GST/FSSAI registration.',
  },
  {
    env: 'NEXT_PUBLIC_LEGAL_JURISDICTION',
    label: 'Governing-law jurisdiction',
    validate: (value) => value.length >= 2,
    hint: 'Example: Bengaluru, Karnataka, India.',
  },
  {
    env: 'NEXT_PUBLIC_LEGAL_FSSAI_LICENCE',
    label: 'FSSAI licence number',
    validate: (value) => /^\d{14}$/.test(value.replace(/\s/g, '')),
    hint: '14 digits, as printed on the FSSAI licence.',
  },
  {
    env: 'NEXT_PUBLIC_LEGAL_GSTIN',
    label: 'GSTIN',
    validate: (value) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(value),
    hint: '15-character GSTIN, for example 29ABCDE1234F1Z5.',
  },
  {
    env: 'NEXT_PUBLIC_SUPPORT_EMAIL',
    label: 'Customer support email',
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    hint: 'A mailbox a customer can actually reach.',
  },
  {
    env: 'NEXT_PUBLIC_SUPPORT_PHONE',
    label: 'Customer support phone',
    validate: (value) => value.replace(/\D/g, '').length >= 10,
    hint: 'Include the country code, for example +91 80 0000 0000.',
  },
  {
    env: 'NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME',
    label: 'Grievance officer name',
    validate: (value) => value.length >= 2,
    hint: 'A named person, not a team alias.',
  },
  {
    env: 'NEXT_PUBLIC_GRIEVANCE_OFFICER_EMAIL',
    label: 'Grievance officer email',
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    hint: 'A mailbox monitored for formal complaints.',
  },
  {
    env: 'NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE',
    label: 'Grievance officer phone',
    validate: (value) => value.replace(/\D/g, '').length >= 10,
    hint: 'A number the grievance officer can be reached on.',
  },
];

const PLACEHOLDER = /^\{\{[A-Z0-9_]+\}\}$/;

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function policyVersions() {
  const web = read(join(process.cwd(), 'src', 'lib', 'legal.ts'));
  const api = read(
    join(process.cwd(), 'apps', 'api', 'src', 'modules', 'auth', 'auth.service.ts'),
  );

  const webVersion = web?.match(/LEGAL_POLICY_VERSION\s*=\s*'([^']+)'/)?.[1];
  const apiVersion = api?.match(/LEGAL_POLICY_VERSION\s*=\s*'([^']+)'/)?.[1];

  return { webVersion, apiVersion };
}

console.log('CraveOS legal identity check');
console.log(`  mode: ${REQUIRE ? 'release (blocking)' : 'development (advisory)'}`);
console.log('');

const missing = [];
const invalid = [];

for (const field of FIELDS) {
  const raw = String(process.env[field.env] || '').trim();

  if (!raw || PLACEHOLDER.test(raw)) {
    missing.push(field);
    console.log(`  MISSING  ${field.label}  (${field.env})`);
    console.log(`           ${field.hint}`);
    continue;
  }

  if (!field.validate(raw)) {
    invalid.push({ field, raw });
    console.log(`  INVALID  ${field.label}  (${field.env})`);
    console.log(`           Got: ${raw}`);
    console.log(`           ${field.hint}`);
    continue;
  }

  console.log(`  OK       ${field.label}`);
}

console.log('');

const { webVersion, apiVersion } = policyVersions();
let versionMismatch = false;

if (!webVersion || !apiVersion) {
  console.log('  MISSING  policy version constant in the web or API source');
  versionMismatch = true;
} else if (webVersion !== apiVersion) {
  console.log(
    `  INVALID  policy version drift: web=${webVersion} api=${apiVersion}`,
  );
  versionMismatch = true;
} else {
  console.log(`  OK       policy version ${webVersion} matches web and API`);
}

console.log('');

if (missing.length === 0 && invalid.length === 0 && !versionMismatch) {
  console.log('Legal identity is complete. The release gate can pass.');
  process.exit(0);
}

const summary = `${missing.length + invalid.length} field(s) need attention${
  versionMismatch ? ', plus a policy-version mismatch' : ''
}.`;

if (REQUIRE) {
  console.error(`BLOCKED: ${summary}`);
  console.error(
    'Supply the values in .env (or the release environment) before shipping. See docs/LEGAL.md.',
  );
  process.exit(1);
}

console.log(`Advisory: ${summary}`);
console.log(
  'This build is not launch-ready. Run "npm run check:legal:release" before a release.',
);
process.exit(0);
