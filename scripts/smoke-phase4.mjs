#!/usr/bin/env node
/**
 * Phase 4 legal + cancellation smoke test.
 *
 * Proves, against a running Next server, API and PostgreSQL database:
 *
 *   legal pages render -> placeholder banner is honest -> policy version is
 *   shared -> signup without consent is refused -> consent is persisted with
 *   the policy version -> existing accounts still sign in -> wallet order
 *   cancellation refunds exactly once -> a second cancel is a no-op ->
 *   cancellation after kitchen acceptance is refused -> kitchen rejection
 *   closes the trip -> account deletion refuses wallet credit, is restricted to
 *   super admin, and anonymises profile data exactly once.
 *
 * Requirements:
 *   - Next dev/prod server on http://localhost:3000 (SMOKE_APP_URL)
 *   - API on http://localhost:4000 (SMOKE_API_URL)
 *   - NODE_ENV=development and DEV_OTP_BYPASS=true (the 123456 bypass)
 *   - seeded hubs, menu items and opsadmin@eatclub.in
 *   - Docker container `craveos-postgres` for row assertions
 *
 * The script only writes fixture data it owns: two throwaway customer accounts
 * and their wallet top-ups. It never mutates existing customers.
 *
 * Run: npm run check:legal-smoke
 */

import { execFileSync } from 'node:child_process';

const APP = (process.env.SMOKE_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const API = (
  process.env.SMOKE_API_URL || 'http://localhost:4000/api/v1'
).replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'opsadmin@eatclub.in';
const SUPER_ADMIN_EMAIL =
  process.env.SMOKE_SUPER_ADMIN_EMAIL || 'superadmin@eatclub.in';
const PG_CONTAINER = process.env.SMOKE_PG_CONTAINER || 'craveos-postgres';
const RUN = Date.now().toString(36);
const EMAIL_A = `phase4-cancel-${RUN}@example.com`;
const EMAIL_NO_CONSENT = `phase4-no-consent-${RUN}@example.com`;
const ITEM = 'zp-2'; // MRP 64900, member 42900, served by hub-hsr-01
const CART = [{ menuItemId: ITEM, quantity: 1 }];
const TOPUP = 100000;
const MEMBER_TOTAL = 45045;

const results = [];
let failed = 0;

function sql(query) {
  return execFileSync(
    'docker',
    ['exec', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', 'craveos', '-t', '-A', '-c', query],
    { encoding: 'utf8' },
  ).trim();
}

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

function step(title) {
  console.log(`\n== ${title} ==`);
}

async function api(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function signIn(email, acceptedLegal = true) {
  const res = await api('POST', '/auth/verify-otp', {
    body: {
      email,
      code: '123456',
      ...(acceptedLegal ? { acceptedLegal: true } : {}),
    },
  });
  return res;
}

async function ensureAddress(token, suffix) {
  const res = await api('POST', '/addresses/ensure', {
    token,
    body: {
      addressLine: `${suffix} Legal Smoke Road ${RUN}`,
      landmark: 'Phase 4 smoke',
      city: 'Bengaluru',
      pincode: '560102',
      lat: 12.9121,
      lng: 77.6445,
      type: 'home',
      label: 'Smoke home',
      isDefault: true,
    },
  });
  return res.json;
}

async function fetchPage(path) {
  const res = await fetch(`${APP}${path}`, {
    headers: { accept: 'text/html' },
    redirect: 'follow',
  });
  const text = await res.text();
  return {
    status: res.status,
    contentType: res.headers.get('content-type') || '',
    text,
  };
}

async function placeWalletOrder(token, addressId, key) {
  return api('POST', '/orders', {
    token,
    headers: { 'idempotency-key': key },
    body: {
      addressId,
      items: CART,
      useWalletBalancePaise: TOPUP,
      paymentMethod: 'WALLET',
    },
  });
}

function walletBalance(userId) {
  return Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userId}';`));
}

async function main() {
  console.log('CraveOS Phase 4 legal + cancellation smoke');
  console.log(`  app: ${APP}`);
  console.log(`  api: ${API}\n`);

  // ------------------------------------------------------------ legal pages
  step('1. Legal pages render and stay honest');
  const pages = [
    ['/legal', 'The rules behind the food'],
    ['/legal/terms', 'Terms of Service'],
    ['/legal/privacy', 'Privacy Policy'],
    ['/legal/refunds', 'Cancel before the kitchen starts'],
    ['/legal/delivery', 'Delivery terms'],
    ['/legal/contact', 'Reach a person, not a void'],
  ];

  for (const [path, marker] of pages) {
    const page = await fetchPage(path);
    check(`${path} returns 200 HTML`, page.status === 200 && page.contentType.includes('text/html'), {
      status: page.status,
      contentType: page.contentType,
    });
    check(`${path} contains "${marker}"`, page.text.includes(marker));
  }

  const termsPage = await fetchPage('/legal/terms');
  check(
    'policy version is rendered on the terms page',
    termsPage.text.includes('2026-10-27'),
  );
  check(
    'terms name the grievance and support surfaces',
    termsPage.text.includes('/legal/contact') &&
      termsPage.text.includes('/legal/refunds'),
  );

  const hasPlaceholders = termsPage.text.includes('{{');
  const hasBanner = termsPage.text.includes('not ready to be relied on');
  check(
    'a placeholder policy is visibly marked before launch',
    !hasPlaceholders || hasBanner,
    { hasPlaceholders, hasBanner },
  );
  check(
    'legal pages are not indexed while incomplete',
    /<meta[^>]+name="robots"[^>]+content="noindex/i.test(termsPage.text) ||
      !hasPlaceholders,
  );

  // --------------------------------------------------------- consent capture
  step('2. Signup requires affirmative consent');
  const refused = await signIn(EMAIL_NO_CONSENT, false);
  check(
    'signup without accepting the policies is refused with 400',
    refused.status === 400,
    refused.json,
  );
  check(
    'the refused email did not create an account',
    sql(`SELECT count(*) FROM users WHERE email = '${EMAIL_NO_CONSENT}';`) === '0',
  );

  const signup = await signIn(EMAIL_A, true);
  const userA = signup.json?.user;
  check('signup with consent succeeds', signup.status === 200 && !!signup.json?.accessToken, signup.json);
  check('signup returns the new account', userA?.email === EMAIL_A, userA);

  const consent = sql(
    `SELECT "termsVersion" || '|' || "privacyVersion" || '|' ||
            ("termsAcceptedAt" IS NOT NULL)::text || '|' ||
            ("privacyAcceptedAt" IS NOT NULL)::text
     FROM users WHERE id = '${userA.id}';`,
  );
  check(
    'consent timestamps and the policy version are stored',
    consent === '2026-10-27|2026-10-27|true|true',
    consent,
  );

  const existingSignIn = await signIn(EMAIL_A, false);
  check(
    'an existing account can still sign in without re-ticking the box',
    existingSignIn.status === 200 && existingSignIn.json?.user?.id === userA.id,
    existingSignIn.json,
  );

  const token = existingSignIn.json?.accessToken;
  const address = await ensureAddress(token, '18');
  check('address resolves to the HSR kitchen', address?.resolvedHubId === 'hub-hsr-01', address);

  step('3. Wallet top-up fixture');
  sql(
    `BEGIN;
     UPDATE users SET "walletBalance" = "walletBalance" + ${TOPUP} WHERE id = '${userA.id}';
     INSERT INTO wallet_transactions ("id","userId","amountInPaise","reason","referenceType","referenceId","createdAt")
     VALUES ('wt-phase4-${RUN}', '${userA.id}', ${TOPUP}, 'ADMIN_ADJUSTMENT', 'SMOKE_TEST', '${RUN}', now());
     COMMIT;`,
  );
  check('wallet starts at the top-up amount', walletBalance(userA.id) === TOPUP);

  // ------------------------------------------------------- refund on cancel
  step('4. Cancelling a paid order refunds exactly once');
  const placed = await placeWalletOrder(token, address.id, `phase4-cancel-${RUN}`);
  const order = placed.json;
  check('wallet order is placed and settled', placed.status < 300 && order?.payment?.status === 'SUCCESS', placed);
  check('wallet was debited by the order total', walletBalance(userA.id) === TOPUP - MEMBER_TOTAL, walletBalance(userA.id));

  const cancelKey = `cancel-${RUN}`;
  const cancelled = await api('POST', `/orders/${order.id}/cancel`, {
    token,
    headers: { 'idempotency-key': cancelKey },
    body: { reason: 'Phase 4 smoke cancellation' },
  });
  check('cancellation succeeds', cancelled.status < 300, cancelled);
  check('order is CANCELLED', cancelled.json?.status === 'CANCELLED', cancelled.json?.status);
  check(
    'payment is REFUNDED',
    cancelled.json?.payment?.status === 'REFUNDED',
    cancelled.json?.payment,
  );
  check(
    'the wallet refund restored the full amount',
    walletBalance(userA.id) === TOPUP,
    walletBalance(userA.id),
  );
  check(
    'exactly one ORDER_REFUND ledger row exists',
    sql(
      `SELECT count(*) FROM wallet_transactions WHERE "orderId" = '${order.id}' AND reason = 'ORDER_REFUND';`,
    ) === '1',
  );
  check(
    'the refund audit entry records the wallet amount',
    sql(
      `SELECT count(*) FROM audit_logs
       WHERE action = 'ORDER_CANCELLED_REFUNDED' AND "recordId" = '${order.id}';`,
    ) === '1',
  );
  check(
    'all kitchen tickets were closed as REJECTED',
    sql(
      `SELECT count(*) FROM brand_orders WHERE "orderId" = '${order.id}' AND status = 'REJECTED';`,
    ) === sql(`SELECT count(*) FROM brand_orders WHERE "orderId" = '${order.id}';`),
  );

  const balanceAfterCancel = walletBalance(userA.id);
  const cancelledAgain = await api('POST', `/orders/${order.id}/cancel`, {
    token,
    body: { reason: 'Second tap' },
  });
  check('a second cancel returns the already-cancelled order', cancelledAgain.status < 300, cancelledAgain);
  check(
    'a second cancel does not refund again',
    walletBalance(userA.id) === balanceAfterCancel,
    walletBalance(userA.id),
  );
  check(
    'the ledger still has exactly one refund row',
    sql(
      `SELECT count(*) FROM wallet_transactions WHERE "orderId" = '${order.id}' AND reason = 'ORDER_REFUND';`,
    ) === '1',
  );

  // -------------------------------------------------- kitchen-started refusal
  step('5. Cancellation closes once the kitchen starts');
  const placed2 = await placeWalletOrder(token, address.id, `phase4-kitchen-${RUN}`);
  const order2 = placed2.json;
  check('second order is placed and settled', placed2.status < 300 && order2?.payment?.status === 'SUCCESS', placed2);

  const admin = await signIn(ADMIN_EMAIL, true);
  check('admin signs in', admin.status === 200 && admin.json?.user?.role === 'ADMIN', admin.json?.user);

  const ticketId = sql(`SELECT id FROM brand_orders WHERE "orderId" = '${order2.id}' LIMIT 1;`);
  check('the order has a kitchen ticket', !!ticketId, ticketId);

  const accepted = await api('PATCH', `/orders/brand-tickets/${ticketId}/status`, {
    token: admin.json?.accessToken,
    body: { status: 'ACCEPTED' },
  });
  check('the kitchen accepts the ticket', accepted.status < 300, accepted);

  const balanceBeforeRefusal = walletBalance(userA.id);
  const refusedCancel = await api('POST', `/orders/${order2.id}/cancel`, {
    token,
    body: { reason: 'Too late' },
  });
  check('cancellation after acceptance is a 409', refusedCancel.status === 409, refusedCancel);
  check(
    'the order is still live',
    sql(`SELECT status FROM orders WHERE id = '${order2.id}';`) !== 'CANCELLED',
  );
  check(
    'the refused cancellation did not move money',
    walletBalance(userA.id) === balanceBeforeRefusal,
    walletBalance(userA.id),
  );

  // Clean up the fixture through the real kitchen-rejection path. This also
  // proves that a rejection closes the delivery trip instead of leaving a
  // rider assigned to an order that will never be cooked.
  step('6. Kitchen rejection closes the order and releases the trip');
  const ticketIds = sql(
    `SELECT id FROM brand_orders WHERE "orderId" = '${order2.id}' AND status <> 'REJECTED';`,
  )
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const id of ticketIds) {
    const rejected = await api('PATCH', `/orders/brand-tickets/${id}/status`, {
      token: admin.json?.accessToken,
      body: { status: 'REJECTED', rejectReason: 'Phase 4 smoke cleanup' },
    });
    check(`ticket ${id} rejects`, rejected.status < 300, rejected);
  }

  check(
    'the rejected order is CANCELLED',
    sql(`SELECT status FROM orders WHERE id = '${order2.id}';`) === 'CANCELLED',
  );
  check(
    'the kitchen rejection refunded the wallet',
    walletBalance(userA.id) === TOPUP,
    walletBalance(userA.id),
  );
  check(
    'the delivery trip is CANCELLED',
    sql(
      `SELECT status FROM delivery_trips WHERE "orderId" = '${order2.id}' ORDER BY "createdAt" DESC LIMIT 1;`,
    ) === 'CANCELLED',
  );

  // ------------------------------------------------ account deletion (DPDP)
  step('7. Account deletion refuses wallet credit and erases profile data');
  const superAdmin = await signIn(SUPER_ADMIN_EMAIL, true);
  check(
    'super admin signs in',
    superAdmin.status === 200 && superAdmin.json?.user?.adminSubRole === 'SUPER_ADMIN',
    superAdmin.json?.user,
  );
  const superAdminToken = superAdmin.json?.accessToken;

  const refusedDelete = await api('DELETE', `/admin/users/${userA.id}`, {
    token: superAdminToken,
  });
  check(
    'deletion is refused while wallet credit remains',
    refusedDelete.status === 409,
    refusedDelete,
  );
  check(
    'the refusal explains the wallet blocker',
    /wallet credit/i.test(refusedDelete.json?.message || ''),
    refusedDelete.json,
  );
  check(
    'the account still exists after the refusal',
    sql(`SELECT count(*) FROM users WHERE id = '${userA.id}';`) === '1',
  );

  const EMAIL_C = `phase4-delete-${RUN}@example.com`;
  const signupC = await signIn(EMAIL_C, true);
  const userC = signupC.json?.user;
  check('deletion fixture account is created', signupC.status === 200 && !!userC?.id, signupC.json);

  const addressC = await ensureAddress(signupC.json?.accessToken, '22');
  check('deletion fixture has a saved address', !!addressC?.id, addressC);
  check(
    'deletion fixture has a trial membership',
    sql(`SELECT count(*) FROM memberships WHERE "userId" = '${userC.id}';`) === '1',
  );

  const opsDeleteAttempt = await api('DELETE', `/admin/users/${userC.id}`, {
    token: admin.json?.accessToken,
  });
  check(
    'an operations admin cannot delete an account',
    opsDeleteAttempt.status === 403,
    opsDeleteAttempt,
  );

  const deleted = await api('DELETE', `/admin/users/${userC.id}`, {
    token: superAdminToken,
  });
  check(
    'deletion succeeds with a zero balance and no live order',
    deleted.status < 300,
    deleted,
  );
  check(
    'the account is anonymised',
    /@eatclub\.invalid$/.test(deleted.json?.email || ''),
    deleted.json,
  );
  check('the account is blocked', deleted.json?.isBlocked === true, deleted.json);
  check(
    'the saved address is gone',
    sql(`SELECT count(*) FROM addresses WHERE "userId" = '${userC.id}';`) === '0',
  );
  check(
    'the current membership is gone',
    sql(`SELECT count(*) FROM memberships WHERE "userId" = '${userC.id}';`) === '0',
  );
  check(
    'the anonymisation is audited',
    sql(
      `SELECT count(*) FROM audit_logs WHERE action = 'USER_ANONYMIZED' AND "recordId" = '${userC.id}';`,
    ) === '1',
  );

  const staleToken = await api('GET', '/auth/me', {
    token: signupC.json?.accessToken,
  });
  check(
    'the deleted account cannot keep using its old session',
    [401, 403].includes(staleToken.status),
    staleToken,
  );

  const deletedAgain = await api('DELETE', `/admin/users/${userC.id}`, {
    token: superAdminToken,
  });
  check(
    'a second deletion is idempotent',
    deletedAgain.status < 300 && deletedAgain.json?.alreadyAnonymized === true,
    deletedAgain,
  );

  console.log('\n--- fixtures created by this run ---');
  console.log(
    JSON.stringify(
      { user: userA.id, cancelledOrder: order.id, liveOrder: order2.id, email: EMAIL_A },
      null,
      2,
    ),
  );
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nLEGAL SMOKE TEST ABORTED');
  console.error(err);
  process.exitCode = 1;
});
