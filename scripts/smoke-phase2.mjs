#!/usr/bin/env node
/**
 * Phase 2 money-path smoke test.
 *
 * Proves, against a running development API and its PostgreSQL database:
 *
 *   trial signup -> serviceability -> address -> member quote with coupon
 *   -> wallet top-up -> invalid-coupon rejection -> wallet order
 *   -> idempotent retry -> redemption + ledger checks -> coupon reuse rejection
 *   -> membership purchase (wallet) -> idempotent retry -> member quote
 *   -> expiry enforcement -> referral attribution
 *   -> kitchen accept/pack -> dispatch -> delivery OTP -> referral reward
 *   -> replay protection -> ledger reconciliation.
 *
 * Requirements:
 *   - API on http://localhost:4000 (override with SMOKE_BASE_URL)
 *   - NODE_ENV=development and DEV_OTP_BYPASS=true (the 123456 bypass)
 *   - seeded hubs, menu items, plans, promotions, and opsadmin@eatclub.in
 *   - Docker container `craveos-postgres` for fixture SQL and row assertions
 *
 * The script only writes fixture data it owns: two new customer accounts and
 * their wallet top-ups. It never mutates existing customers.
 *
 * Run: npm run check:money-smoke
 */

import { execFileSync } from 'node:child_process';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4000/api/v1';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'opsadmin@eatclub.in';
const PG_CONTAINER = process.env.SMOKE_PG_CONTAINER || 'craveos-postgres';
const RUN = Date.now().toString(36);
const EMAIL_A = `phase2-smoke-a-${RUN}@example.com`;
const EMAIL_B = `phase2-smoke-b-${RUN}@example.com`;
const ITEM = 'zp-2'; // MRP 64900, member 42900, served by hub-hsr-01
const CART = [{ menuItemId: ITEM, quantity: 1 }];
const TOPUP = 200000;
const DELIVERY_TOPUP = 100000;

const results = [];
let failed = 0;

function sql(query) {
  return execFileSync(
    'docker',
    [ 'exec', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', 'craveos', '-t', '-A', '-c', query ],
    { encoding: 'utf8' },
  ).trim();
}

async function api(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
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

function check(name, condition, detail) {
  if (condition) {
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    results.push({ name, ok: false, detail });
    console.log(`  FAIL  ${name}`);
    if (detail !== undefined) {
      console.log(
        `        ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`,
      );
    }
  }
}

function step(title) {
  console.log(`\n== ${title} ==`);
}

async function signIn(email, referralCode) {
  const res = await api('POST', '/auth/verify-otp', {
    body: { email, code: '123456', ...(referralCode ? { referralCode } : {}) },
  });
  if (res.status >= 300) {
    throw new Error(`sign-in failed for ${email}: ${JSON.stringify(res.json)}`);
  }
  return {
    token: res.json.accessToken || res.json.token || res.json.access_token,
    user: res.json.user,
    referralApplied: res.json.referralApplied,
  };
}

async function ensureAddress(token, suffix) {
  const res = await api('POST', '/addresses/ensure', {
    token,
    body: {
      addressLine: `${suffix} Smoke Test Road ${RUN}`,
      landmark: 'Phase 2 smoke',
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

async function main() {
  step('1. Trial signup (email OTP, no welcome cash)');
  const a = await signIn(EMAIL_A);
  const userA = a.user;
  check('signup returns an access token', !!a.token, a);
  check('signup creates a trial membership', userA?.membership?.planId === 'plan-trial', userA?.membership);
  check(
    'trial expiry is ~30 days out',
    !!userA?.membership?.endsAt &&
      Math.abs(
        new Date(userA.membership.endsAt).getTime() - (Date.now() + 30 * 86400000),
      ) <
        5 * 60000,
    userA?.membership?.endsAt,
  );
  check('new account has zero wallet cash', userA?.walletBalance === 0, userA?.walletBalance);
  check(
    'referral code is generated',
    /^REF-[A-Z0-9]{10}$/.test(userA?.referralCode || ''),
    userA?.referralCode,
  );
  check('phone is not fabricated', userA?.phone === null || userA?.phone === undefined, userA?.phone);

  const meA = await api('GET', '/auth/me', { token: a.token });
  check('/auth/me returns the same account', meA.json?.user?.id === userA.id, meA.json);

  step('2. Serviceability and address');
  const svc = await api('POST', '/catalog/serviceability/resolve', {
    body: { lat: 12.9121, lng: 77.6445 },
  });
  check('HSR coordinates resolve to a hub', svc.json?.isServiceable === true, svc.json);
  check('resolved hub is hub-hsr-01', svc.json?.hubId === 'hub-hsr-01', svc.json);

  const addressA = await ensureAddress(a.token, '12');
  check('address is created', !!addressA?.id, addressA);
  check('address carries the resolved hub', addressA?.resolvedHubId === 'hub-hsr-01', addressA);

  step('3. Quote engine (trial member, WELCOME100)');
  const anon = await api('POST', '/pricing/quote', {
    body: { addressId: addressA.id, items: CART },
  });
  check('quote rejects anonymous callers', anon.status === 401 || anon.status === 403, anon);

  const quote1 = await api('POST', '/pricing/quote', {
    token: a.token,
    body: { addressId: addressA.id, items: CART, couponCode: 'WELCOME100' },
  });
  const amounts1 = quote1.json?.amounts || {};
  check('quote marks the trial as member', quote1.json?.isMember === true, quote1.json?.isMember);
  check('item total is the DB MRP', amounts1.itemTotalPaise === 64900, amounts1);
  check('member discount is the DB price delta', amounts1.memberDiscountPaise === 22000, amounts1);
  check('member pays no delivery fee', amounts1.deliveryFeePaise === 0, amounts1);
  check('member pays no packaging fee', amounts1.packagingFeePaise === 0, amounts1);
  check('WELCOME100 applies 10000 paise', amounts1.couponDiscountPaise === 10000, amounts1);
  check('GST is 5% of the discounted food subtotal', amounts1.taxPaise === 1645, amounts1);
  check('gross total is 34545 paise', amounts1.grossTotalPaise === 34545, amounts1);
  check('coupon is reported as applied', quote1.json?.coupon?.applied === true, quote1.json?.coupon);

  const quoteBad = await api('POST', '/pricing/quote', {
    token: a.token,
    body: { addressId: addressA.id, items: CART, couponCode: 'NOPE123' },
  });
  check(
    'unknown coupon is rejected, not silently ignored',
    quoteBad.json?.coupon?.invalid === true,
    quoteBad.json?.coupon,
  );
  check(
    'unknown coupon adds no discount',
    quoteBad.json?.amounts?.couponDiscountPaise === 0,
    quoteBad.json?.amounts,
  );
  check(
    'undiscounted member total is 45045 paise',
    quoteBad.json?.amounts?.grossTotalPaise === 45045,
    quoteBad.json?.amounts,
  );

  step('4. Wallet top-up (ledger-consistent fixture)');
  sql(
    `BEGIN;
     UPDATE users SET "walletBalance" = "walletBalance" + ${TOPUP} WHERE id = '${userA.id}';
     INSERT INTO wallet_transactions ("id","userId","amountInPaise","reason","referenceType","referenceId","createdAt")
     VALUES ('wt-smoke-${RUN}', '${userA.id}', ${TOPUP}, 'ADMIN_ADJUSTMENT', 'SMOKE_TEST', '${RUN}', now());
     COMMIT;`,
  );
  check(
    'wallet top-up applied',
    Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userA.id}';`)) === TOPUP,
  );

  step('5. Order placement rejects an invalid coupon');
  const badOrder = await api('POST', '/orders', {
    token: a.token,
    headers: { 'idempotency-key': `smoke-bad-${RUN}` },
    body: {
      addressId: addressA.id,
      items: CART,
      couponCode: 'NOPE123',
      useWalletBalancePaise: TOPUP,
      paymentMethod: 'WALLET',
    },
  });
  check('invalid coupon aborts order creation', badOrder.status === 400, badOrder);
  check(
    'aborted order charged nothing',
    Number(sql(`SELECT count(*) FROM orders WHERE "userId" = '${userA.id}';`)) === 0,
  );

  step('6. Wallet order with WELCOME100');
  const orderKey = `smoke-order-${RUN}`;
  const placed = await api('POST', '/orders', {
    token: a.token,
    headers: { 'idempotency-key': orderKey },
    body: {
      addressId: addressA.id,
      items: CART,
      couponCode: 'WELCOME100',
      useWalletBalancePaise: TOPUP,
      paymentMethod: 'WALLET',
    },
  });
  const orderA = placed.json;
  check('order is created', placed.status === 201 || placed.status === 200, placed);
  check('order status is PLACED', orderA?.status === 'PLACED', orderA?.status);
  check('wallet covered the whole bill', orderA?.walletAppliedPaise === 34545, orderA?.walletAppliedPaise);
  check('nothing left for the gateway', orderA?.finalPaidPaise === 0, orderA?.finalPaidPaise);
  check('stored MRP matches the quote', orderA?.mrpTotalPaise === 64900, orderA?.mrpTotalPaise);
  check('stored member savings match the quote', orderA?.memberSavingsPaise === 22000, orderA?.memberSavingsPaise);
  check('stored tax matches the quote', orderA?.taxPaise === 1645, orderA?.taxPaise);
  check('order carries one settled payment', orderA?.payment?.status === 'SUCCESS', orderA?.payment);

  check(
    'wallet debited exactly the order value',
    Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userA.id}';`)) ===
      TOPUP - 34545,
  );
  check(
    'one promotion redemption is recorded',
    sql(`SELECT count(*) FROM promotion_redemptions WHERE "orderId" = '${orderA.id}';`) === '1',
  );

  step('7. Idempotent retry does not double-charge');
  const retried = await api('POST', '/orders', {
    token: a.token,
    headers: { 'idempotency-key': orderKey },
    body: {
      addressId: addressA.id,
      items: CART,
      couponCode: 'WELCOME100',
      useWalletBalancePaise: TOPUP,
      paymentMethod: 'WALLET',
    },
  });
  check('retry returns the same order', retried.json?.id === orderA.id, retried.json?.id);
  check(
    'retry did not debit the wallet again',
    Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userA.id}';`)) ===
      TOPUP - 34545,
  );
  check(
    'retry did not create a second order',
    Number(sql(`SELECT count(*) FROM orders WHERE "userId" = '${userA.id}';`)) === 1,
  );

  step('8. One-use coupon cannot be reused');
  const reuse = await api('POST', '/pricing/quote', {
    token: a.token,
    body: { addressId: addressA.id, items: CART, couponCode: 'WELCOME100' },
  });
  check('WELCOME100 is now invalid', reuse.json?.coupon?.invalid === true, reuse.json?.coupon);
  check(
    'rejection reason is FIRST_ORDER_ONLY',
    reuse.json?.coupon?.reason === 'FIRST_ORDER_ONLY',
    reuse.json?.coupon,
  );

  step('9. Membership purchase with wallet');
  const plans = await api('GET', '/membership/plans');
  check(
    'public plan list returns the three paid plans',
    Array.isArray(plans.json) && plans.json.length === 3,
    plans.json,
  );
  check(
    'monthly plan is 9900 paise',
    plans.json?.find((p) => p.slug === 'monthly')?.priceInPaise === 9900,
    plans.json,
  );

  const purchaseKey = `smoke-membership-${RUN}`;
  const purchase = await api('POST', '/membership/purchase', {
    token: a.token,
    headers: { 'idempotency-key': purchaseKey },
    body: { planSlug: 'monthly', paymentMethod: 'WALLET' },
  });
  check('membership purchase succeeds', purchase.status === 201 || purchase.status === 200, purchase);
  check('purchase activates plan-monthly', purchase.json?.membership?.planId === 'plan-monthly', purchase.json?.membership);
  check('purchase records 9900 paise', purchase.json?.amountInPaise === 9900, purchase.json);
  check(
    'paid plan starts immediately (trial forfeited)',
    !!purchase.json?.membership?.endsAt &&
      Math.abs(
        new Date(purchase.json.membership.endsAt).getTime() - (Date.now() + 30 * 86400000),
      ) <
        5 * 60000,
    purchase.json?.membership,
  );
  check(
    'wallet debited the plan price',
    Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userA.id}';`)) ===
      TOPUP - 34545 - 9900,
  );

  const purchaseRetry = await api('POST', '/membership/purchase', {
    token: a.token,
    headers: { 'idempotency-key': purchaseKey },
    body: { planSlug: 'monthly', paymentMethod: 'WALLET' },
  });
  check('purchase retry returns the same purchase', purchaseRetry.json?.purchaseId === purchase.json?.purchaseId, purchaseRetry.json);
  check(
    'purchase retry did not debit again',
    Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userA.id}';`)) ===
      TOPUP - 34545 - 9900,
  );

  step('10. Member quote after paid activation');
  const quoteMember = await api('POST', '/pricing/quote', {
    token: a.token,
    body: { addressId: addressA.id, items: CART },
  });
  check('paid membership is active', quoteMember.json?.membership?.planId === 'plan-monthly', quoteMember.json?.membership);
  check('member delivery fee stays zero', quoteMember.json?.amounts?.deliveryFeePaise === 0, quoteMember.json?.amounts);
  check(
    'member total is 45045 paise',
    quoteMember.json?.amounts?.grossTotalPaise === 45045,
    quoteMember.json?.amounts,
  );

  step('11. Expired membership loses member pricing');
  sql(
    `UPDATE memberships SET status = 'EXPIRED', "endsAt" = now() - interval '1 day' WHERE "userId" = '${userA.id}';`,
  );
  const quoteExpired = await api('POST', '/pricing/quote', {
    token: a.token,
    body: { addressId: addressA.id, items: CART },
  });
  check('expired membership is not a member', quoteExpired.json?.isMember === false, quoteExpired.json?.isMember);
  check('guest pays delivery', quoteExpired.json?.amounts?.deliveryFeePaise === 4500, quoteExpired.json?.amounts);
  check('guest pays packaging', quoteExpired.json?.amounts?.packagingFeePaise === 2500, quoteExpired.json?.amounts);
  check(
    'guest total is 76080 paise',
    quoteExpired.json?.amounts?.grossTotalPaise === 76080,
    quoteExpired.json?.amounts,
  );
  sql(
    `UPDATE memberships SET status = 'ACTIVE', "endsAt" = now() + interval '30 days' WHERE "userId" = '${userA.id}';`,
  );

  step('12. Referral attribution');
  sql(`UPDATE orders SET status = 'DELIVERED' WHERE id = '${orderA.id}';`);
  const b = await signIn(EMAIL_B, userA.referralCode);
  const userB = b.user;
  check('referral is applied at signup', b.referralApplied === true, b.referralApplied);
  check('referee is a separate account', userB?.id !== userA.id, userB?.id);
  check(
    'referee account is linked to the referrer',
    sql(
      `SELECT count(*) FROM referrals WHERE "refereeId" = '${userB.id}' AND "referrerId" = '${userA.id}' AND status = 'PENDING';`,
    ) === '1',
  );
  const refsA = await api('GET', '/referrals/me', { token: a.token });
  check(
    'referrer sees one attributed referral',
    Array.isArray(refsA.json?.referrals) && refsA.json.referrals.length === 1,
    refsA.json,
  );
  check(
    'referral is pending until first delivery',
    refsA.json?.referrals?.[0]?.status === 'PENDING',
    refsA.json?.referrals?.[0],
  );

  step('13. Referee order for the delivery payout');
  const addressB = await ensureAddress(b.token, '44');
  check('referee address resolves to HSR', addressB?.resolvedHubId === 'hub-hsr-01', addressB);

  sql(
    `BEGIN;
     UPDATE users SET "walletBalance" = "walletBalance" + ${DELIVERY_TOPUP} WHERE id = '${userB.id}';
     INSERT INTO wallet_transactions ("id","userId","amountInPaise","reason","referenceType","referenceId","createdAt")
     VALUES ('wt-payout-${RUN}', '${userB.id}', ${DELIVERY_TOPUP}, 'ADMIN_ADJUSTMENT', 'SMOKE_TEST', '${RUN}', now());
     COMMIT;`,
  );
  const placedB = await api('POST', '/orders', {
    token: b.token,
    headers: { 'idempotency-key': `payout-order-${RUN}` },
    body: {
      addressId: addressB.id,
      items: CART,
      useWalletBalancePaise: DELIVERY_TOPUP,
      paymentMethod: 'WALLET',
    },
  });
  const orderB = placedB.json;
  check('referee order is placed and settled', orderB?.payment?.status === 'SUCCESS', placedB);
  check('referee order is fully covered by wallet', orderB?.finalPaidPaise === 0, orderB?.finalPaidPaise);
  const walletBAfterOrder = Number(
    sql(`SELECT "walletBalance" FROM users WHERE id = '${userB.id}';`),
  );

  step('14. Kitchen accept, pack, dispatch and deliver');
  const admin = await signIn(ADMIN_EMAIL);
  check('admin is an operations admin', admin.user?.role === 'ADMIN', admin.user);

  const tickets = sql(`SELECT id FROM brand_orders WHERE "orderId" = '${orderB.id}';`)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  check('order has at least one kitchen ticket', tickets.length >= 1, tickets);

  for (const ticketId of tickets) {
    for (const status of ['ACCEPTED', 'PREPARING', 'READY']) {
      const res = await api('PATCH', `/orders/brand-tickets/${ticketId}/status`, {
        token: admin.token,
        body: { status },
      });
      if (res.status >= 300) check(`ticket ${ticketId} → ${status}`, false, res);
    }
  }
  check(
    'all tickets are READY',
    sql(
      `SELECT string_agg(DISTINCT status::text, ',') FROM brand_orders WHERE "orderId" = '${orderB.id}';`,
    ) === 'READY',
  );

  const assigned = await api('POST', `/logistics/auto-assign/${orderB.id}`, { token: admin.token });
  const tripId = assigned.json?.trip?.id;
  const riderId = assigned.json?.trip?.riderId;
  check('a rider is assigned', !!tripId && !!riderId, assigned.json);
  check('trip starts ASSIGNED', assigned.json?.trip?.status === 'ASSIGNED', assigned.json?.trip);

  const riderActions = [
    ['accept', `/logistics/trips/${tripId}/accept`, { riderId }],
    ['arrived-hub', `/logistics/trips/${tripId}/arrived-hub`, { riderId, lat: 12.9121, lng: 77.6445 }],
    ['pickup', `/logistics/trips/${tripId}/pickup`, { riderId }],
    ['arrived-customer', `/logistics/trips/${tripId}/arrived-customer`, { riderId }],
  ];
  for (const [label, path, body] of riderActions) {
    const res = await api('POST', path, { token: admin.token, body });
    check(`rider step ${label}`, res.status < 300, res);
  }

  const buyerView = await api('GET', `/orders/${orderB.id}`, { token: b.token });
  const otp = buyerView.json?.deliveryTrip?.deliveryOtp;
  check('buyer can read the delivery OTP', /^\d{4}$/.test(otp || ''), buyerView.json?.deliveryTrip);
  const adminView = await api('GET', `/orders/${orderB.id}`, { token: admin.token });
  check(
    'admin can read the delivery OTP for disputes',
    adminView.json?.deliveryTrip?.deliveryOtp === otp,
    adminView.json?.deliveryTrip?.deliveryOtp,
  );

  const walletABefore = Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userA.id}';`));
  const delivered = await api('POST', `/logistics/trips/${tripId}/deliver`, {
    token: admin.token,
    body: { riderId, otp },
  });
  check('delivery completes', delivered.status < 300, delivered);

  step('15. Referral reward paid exactly once');
  check(
    'referral is REWARDED',
    sql(
      `SELECT status FROM referrals WHERE "refereeId" = '${userB.id}' AND "referrerId" = '${userA.id}';`,
    ) === 'REWARDED',
  );
  check(
    'referrer received ₹100',
    Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userA.id}';`)) -
      walletABefore ===
      10000,
  );
  check(
    'referee received ₹50',
    Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userB.id}';`)) -
      walletBAfterOrder ===
      5000,
  );

  const rewardRows = sql(
    `SELECT w."userId" || ':' || w."amountInPaise"
     FROM wallet_transactions w
     JOIN referrals r ON r.id = w."referenceId"
     WHERE w.reason = 'REFERRAL_REWARD'
       AND w."referenceType" = 'REFERRAL'
       AND r."refereeId" = '${userB.id}'
     ORDER BY w."amountInPaise" DESC;`,
  )
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  check(
    'reward ledger rows are +10000 and +5000',
    rewardRows.includes(`${userA.id}:10000`) && rewardRows.includes(`${userB.id}:5000`),
    rewardRows,
  );
  check(
    'order is DELIVERED',
    sql(`SELECT status FROM orders WHERE id = '${orderB.id}';`) === 'DELIVERED',
  );

  step('16. Replay cannot pay twice');
  const replay = await api('POST', `/logistics/trips/${tripId}/deliver`, {
    token: admin.token,
    body: { riderId, otp },
  });
  check('second delivery attempt is rejected', replay.status === 409, replay);
  check(
    'referrer was not paid again',
    Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userA.id}';`)) -
      walletABefore ===
      10000,
  );
  check(
    'referee was not paid again',
    Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userB.id}';`)) -
      walletBAfterOrder ===
      5000,
  );

  step('17. Ledger reconciliation');
  const drift = sql(
    `SELECT count(*) FROM (
       SELECT u.id FROM users u
       LEFT JOIN wallet_transactions w ON w."userId" = u.id
       WHERE u.id IN ('${userA.id}','${userB.id}')
       GROUP BY u.id
       HAVING u."walletBalance" <> COALESCE(SUM(w."amountInPaise"), 0)
     ) d;`,
  );
  check('both accounts reconcile with the ledger', drift === '0', drift);
  check(
    'new accounts never receive WELCOME_BONUS cash',
    sql(
      `SELECT count(*) FROM wallet_transactions WHERE reason = 'WELCOME_BONUS' AND "userId" IN ('${userA.id}','${userB.id}');`,
    ) === '0',
  );

  console.log('\n--- fixtures created by this run ---');
  console.log(
    JSON.stringify(
      { userA: userA.id, userB: userB.id, orderA: orderA.id, orderB: orderB.id, emailA: EMAIL_A, emailB: EMAIL_B },
      null,
      2,
    ),
  );
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nMONEY SMOKE TEST ABORTED');
  console.error(err);
  process.exitCode = 1;
});
