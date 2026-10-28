#!/usr/bin/env node
/**
 * CraveOS no-fakes guard.
 *
 * Fails the build when the storefront or API reintroduces a surface that looks
 * real but is backed by mocks, invented copy, or a client-side guess.
 *
 * Run: npm run check:no-fakes
 *
 * Escape hatch: put `no-fakes-allow: <rule-id> <reason>` on the offending line
 * or the line above it. Use it only for a deliberate, reviewed exception.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep, posix } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  '.turbo',
  'out',
]);
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/** @typedef {{ id: string, why: string, include: string[], pattern: RegExp }} Rule */

/** @type {Rule[]} */
const RULES = [
  {
    id: 'mock-data-import',
    why: 'Imports the deleted mock catalogue. Render API data or an honest empty state.',
    include: ['src/'],
    pattern: /(?:from\s*|require\s*\(\s*)['"][^'"]*mockData['"]/,
  },
  {
    id: 'mock-identifier',
    why: 'References a MOCK_* fixture. Fixtures must not reach a user-visible surface.',
    include: ['src/'],
    pattern: /\bMOCK_[A-Z0-9_]+\b/,
  },
  {
    id: 'dev-otp-literal',
    why: 'Hardcodes the dev OTP. The client must never invent a verification code.',
    include: ['src/'],
    pattern: /['"`]123456['"`]/,
  },
  {
    id: 'demo-credential',
    why: 'Prefills a seeded demo account. Forms start empty.',
    include: ['src/'],
    pattern: /alex\.morgan@eatclub\.in|\+919900011101/,
  },
  {
    id: 'native-dialog',
    why: 'Uses a blocking browser dialog. Use the shared Dialog primitive.',
    include: ['src/'],
    pattern: /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/,
  },
  {
    id: 'ai-assistant',
    why: 'The AI assistant was removed in Phase 0. Do not reintroduce it.',
    include: ['src/', 'apps/api/src/'],
    pattern: /@google\/genai|AICraveAssistant|CraveAI/,
  },
  {
    id: 'cash-on-delivery',
    why: 'Cash on delivery was removed. Supported methods are UPI, CARD, WALLET.',
    include: ['src/', 'apps/api/src/'],
    pattern: /Cash on Delivery|['"`]COD['"`]/,
  },
  {
    id: 'fake-marketing-claim',
    why: 'Hardcoded marketing claim with no database or pricing source.',
    include: ['src/'],
    pattern:
      /Flat 30%|30% OFF|EATCLUB100|CRAVE50|WELCOME100|FIRST30|Happy Hours Live|Priority Kitchen Queue|Secret Brand Drops|VIP Rider Dispatching|18,000\+|FREE \(₹0\)|22 Mins|22 mins|₹0 Delivery|₹0 delivery/,
  },
  {
    id: 'hardcoded-eta',
    why: 'Invents a delivery estimate. ETA must come from a measured or computed source.',
    include: ['apps/api/src/'],
    pattern: /estimatedDeliveryMins\s*:\s*22\b/,
  },
  {
    id: 'fake-offer-fallback',
    why: 'Invents a promotion when the database has no active rule.',
    include: ['apps/api/src/'],
    pattern: /Happy Hours Live|MOJO 2X Loaded|isHappyHour:\s*happyHourRule\s*\?/,
  },
  {
    id: 'legacy-pricing-rule',
    why: 'The PricingRule model was removed. Quotes and promotions use Promotion.',
    include: ['src/', 'apps/api/src/'],
    pattern: /\bPricingRule\b/,
  },
  {
    id: 'legacy-quote-endpoint',
    why: 'The unauthenticated /pricing/calculate endpoint was removed. Use POST /pricing/quote.',
    include: ['src/', 'apps/api/src/'],
    pattern: /\/pricing\/calculate\b/,
  },
  {
    id: 'legacy-promotion-status',
    why: 'Promotion proposals use PENDING_APPROVAL. PENDING_ADMIN_APPROVAL no longer exists.',
    include: ['src/', 'apps/api/src/'],
    pattern: /\bPENDING_ADMIN_APPROVAL\b/,
  },
  {
    id: 'welcome-wallet-cash',
    why: 'New accounts receive a first-order coupon, never wallet cash. Do not reintroduce WELCOME_BONUS credits.',
    include: ['apps/api/src/modules/auth/'],
    pattern: /\bWELCOME_BONUS\b/,
  },
  {
    id: 'fake-membership-screen',
    why: 'The static membership screen was deleted. Membership is purchased inside ProfileScreen.',
    include: ['src/'],
    pattern: /\bMembershipScreen\b/,
  },
  {
    id: 'hardcoded-coords',
    why: 'Pins the storefront to fixed coordinates instead of the selected address.',
    include: ['src/'],
    pattern: /12\.9121|77\.6445/,
  },
  {
    id: 'fake-rating-literal',
    why: 'Hardcodes a star rating. Ratings stay hidden until reviews exist.',
    include: ['src/'],
    pattern: /\brating:\s*4\.[0-9]/,
  },
  {
    id: 'silent-notification-success',
    why: 'Reports success when no email was sent. Return a failure and let the caller decide.',
    include: ['apps/api/src/modules/notifications/'],
    pattern: /return\s*\{\s*success:\s*true\s*\}/,
  },
  {
    id: 'localstorage-token',
    why: 'Access tokens belong in the httpOnly session cookie set by the BFF, never in localStorage where XSS can read them.',
    include: ['src/', 'app/'],
    pattern:
      /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"`]eatclub_token['"`]/,
  },
  {
    id: 'client-bearer-header',
    why: 'The browser must not attach API credentials itself; the BFF converts the httpOnly cookie into a Bearer header server-side.',
    include: ['src/'],
    pattern: /['"`]Authorization['"`]\s*:/,
  },
  {
    id: 'direct-api-base',
    why: 'Browser code must call /api/bff, not the NestJS API origin, so the token never reaches JavaScript.',
    include: ['src/'],
    pattern: /NEXT_PUBLIC_API_URL|localhost:4000\/api\/v1/,
  },
  {
    id: 'access-token-in-browser',
    why: 'The BFF strips accessToken from every response. A client that reads it means the token is exposed to JavaScript again.',
    include: ['src/'],
    pattern: /\.accessToken\b/,
  },
  {
    id: 'hardcoded-gstin',
    why: 'A GSTIN is legal identity, not copy. It must come from NEXT_PUBLIC_LEGAL_GSTIN so the release gate can verify it.',
    include: ['src/', 'app/', 'apps/api/src/'],
    pattern: /\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/,
  },
  {
    id: 'hardcoded-fssai',
    why: 'An FSSAI licence number is legal identity, not copy. It must come from NEXT_PUBLIC_LEGAL_FSSAI_LICENCE so the release gate can verify it.',
    include: ['src/', 'app/', 'apps/api/src/'],
    pattern: /\b\d{14}\b/,
  },
  {
    id: 'invented-certification',
    why: 'Do not claim a certification or approval the operator has not supplied. FSSAI and GST values are configuration, not marketing copy.',
    include: ['src/', 'app/'],
    pattern: /\bISO\s*22000\b|\bFSSAI\s+certified\b|\b100%\s+safe\b/i,
  },
];

const ALLOW_MARKER = 'no-fakes-allow';

function toPosix(value) {
  return value.split(sep).join(posix.sep);
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
      continue;
    }
    if (!entry.isFile()) continue;

    const dot = entry.name.lastIndexOf('.');
    if (dot === -1) continue;
    if (!SCAN_EXTENSIONS.has(entry.name.slice(dot))) continue;

    out.push(join(dir, entry.name));
  }
}

function isAllowed(lines, index, ruleId) {
  const current = lines[index] || '';
  const previous = index > 0 ? lines[index - 1] : '';
  for (const line of [current, previous]) {
    const at = line.indexOf(ALLOW_MARKER);
    if (at === -1) continue;
    const tail = line.slice(at);
    if (tail.includes(ruleId) || tail.includes('*')) return true;
  }
  return false;
}

function scanCode() {
  const files = [];
  walk(join(ROOT, 'src'), files);
  walk(join(ROOT, 'app'), files);
  walk(join(ROOT, 'apps', 'api', 'src'), files);

  const findings = [];
  let scanned = 0;

  for (const absolute of files) {
    const relativePath = toPosix(relative(ROOT, absolute));
    const applicable = RULES.filter((rule) =>
      rule.include.some((prefix) => relativePath.startsWith(prefix)),
    );
    if (applicable.length === 0) continue;

    let content;
    try {
      content = readFileSync(absolute, 'utf8');
    } catch {
      continue;
    }

    scanned += 1;
    const lines = content.split(/\r?\n/);

    for (const rule of applicable) {
      const matcher = new RegExp(
        rule.pattern.source,
        rule.pattern.flags.includes('g')
          ? rule.pattern.flags
          : `${rule.pattern.flags}g`,
      );

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        matcher.lastIndex = 0;
        let match;
        while ((match = matcher.exec(line)) !== null) {
          if (isAllowed(lines, index, rule.id)) {
            if (match[0].length === 0) matcher.lastIndex += 1;
            continue;
          }
          findings.push({
            file: relativePath,
            line: index + 1,
            column: match.index + 1,
            rule: rule.id,
            why: rule.why,
            excerpt: line.trim().slice(0, 160),
          });
          if (match[0].length === 0) matcher.lastIndex += 1;
        }
      }
    }
  }

  return { scanned, findings };
}

const STATUSES = new Set(['LIVE', 'API', 'HIDDEN', 'PLANNED', 'REMOVED']);
const EMPTY_VALUES = new Set(['', 'none', 'n/a', '—', '-', 'tbd']);

function splitRow(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function scanRegistry() {
  const path = join(ROOT, 'docs', 'FEATURES.md');
  const problems = [];

  if (!existsSync(path)) {
    return {
      count: 0,
      byStatus: {},
      problems: [
        {
          file: 'docs/FEATURES.md',
          line: 1,
          message: 'Feature registry is missing.',
        },
      ],
    };
  }

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const byStatus = {};
  let count = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith('|')) continue;

    const cells = splitRow(line);
    if (cells.length < 6) continue;

    const [feature, status, surface, source, verification] = cells;
    if (!STATUSES.has(status)) continue;

    count += 1;
    byStatus[status] = (byStatus[status] || 0) + 1;

    if ((status === 'LIVE' || status === 'API') && EMPTY_VALUES.has(source.toLowerCase())) {
      problems.push({
        file: 'docs/FEATURES.md',
        line: index + 1,
        message: `${feature}: ${status} requires a Source.`,
      });
    }

    if (
      (status === 'LIVE' || status === 'API') &&
      EMPTY_VALUES.has(verification.toLowerCase())
    ) {
      problems.push({
        file: 'docs/FEATURES.md',
        line: index + 1,
        message: `${feature}: ${status} requires a Verification step.`,
      });
    }

    if (status === 'LIVE' && EMPTY_VALUES.has(surface.toLowerCase())) {
      problems.push({
        file: 'docs/FEATURES.md',
        line: index + 1,
        message: `${feature}: LIVE requires a Surface.`,
      });
    }

    if (status === 'LIVE') {
      const paths = [...surface.matchAll(/`([^`]+)`/g)]
        .map((match) => match[1])
        .filter((value) => /^(src|app|apps|prisma|scripts)\//.test(value));

      for (const candidate of paths) {
        if (!existsSync(join(ROOT, candidate))) {
          problems.push({
            file: 'docs/FEATURES.md',
            line: index + 1,
            message: `${feature}: surface path does not exist: ${candidate}`,
          });
        }
      }
    }
  }

  return { count, byStatus, problems };
}

function main() {
  const code = scanCode();
  const registry = scanRegistry();

  console.log('CraveOS no-fakes check');
  console.log(`  Scanned ${code.scanned} source files.`);
  const summary = Object.entries(registry.byStatus)
    .map(([status, value]) => `${value} ${status}`)
    .join(', ');
  console.log(`  Registry: ${registry.count} features${summary ? ` (${summary})` : ''}.`);

  if (registry.problems.length > 0) {
    console.log('\nRegistry problems:');
    for (const problem of registry.problems) {
      console.log(`  ${problem.file}:${problem.line}  ${problem.message}`);
    }
  }

  if (code.findings.length > 0) {
    console.log('\nFindings:');
    let currentFile = '';
    for (const finding of code.findings) {
      if (finding.file !== currentFile) {
        currentFile = finding.file;
        console.log(`\n  ${currentFile}`);
      }
      console.log(
        `    ${finding.line}:${finding.column}  ${finding.rule}  ${finding.why}`,
      );
      console.log(`      ${finding.excerpt}`);
    }
  }

  const total = code.findings.length + registry.problems.length;
  if (total > 0) {
    console.log(`\nFAIL: ${total} finding${total === 1 ? '' : 's'}.`);
    process.exit(1);
  }

  console.log('\nPASS: no fake surfaces detected.');
}

main();
