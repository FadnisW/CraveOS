#!/usr/bin/env node
/**
 * Phase 5 customer-product smoke test.
 *
 * Proves, against a running Next server, API and PostgreSQL database:
 *
 *   hub-scoped catalog -> variant/add-on pricing -> order options snapshot and
 *   delivery-contact snapshot -> profile edit -> threaded support ticket with
 *   assignment and resolution -> verified-purchase review moderation (approve
 *   and reject) -> lifecycle notification rows with no duplicate sends ->
 *   membership confirmation email exactly once.
 *
 * Requirements:
 *   - Next dev/prod server on http://localhost:3000 (SMOKE_APP_URL)
 *   - API on http://localhost:4000 (SMOKE_API_URL)
 *   - NODE_ENV=development and DEV_OTP_BYPASS=true (the 123456 bypass)
 *   - seeded hubs, menu items, plans and the support/operations admins
 *   - Docker container `craveos-postgres` for row assertions
 *
 * The script only writes fixture data it owns: throwaway customer accounts,
 * their addresses, wallet top-ups, orders, tickets and reviews. It never
 * mutates existing customers.
 *
 * Run: npm run check:phase5-smoke
 */

import { execFileSync } from 'node:child_process';

const APP = (process.env.SMOKE_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const API = (
  process.env.SMOKE_API_URL || 'http://localhost:4000/api/v1'
).replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'opsadmin@eatclub.in';
const SUPPORT_EMAIL =
  process.env.SMOKE_SUPPORT_EMAIL || 'support.admin@eatclub.in';
const PG_CONTAINER = process.env.SMOKE_PG_CONTAINER || 'craveos-postgres';
const RUN = Date.now().toString(36);

const EMAIL_A = `phase5-customer-${RUN}@example.com`;
const EMAIL_B = `phase5-other-${RUN}@example.com`;

const HSR_HUB = 'hub-hsr-01';
const INDIRANAGAR_HUB = 'hub-indiranagar-02';

// pz-1 base: MRP 49900 / member 34900. The 12" variant replaces the base
// price; Extra Mozzarella adds to both sides.
const PIZZA = 'pz-1';
const PIZZA_INDIRANAGAR = 'pz-1__hub-indiranagar-02';
const MOJO_SLUG = 'mojo-pizza';
const ZULUS_SLUG = 'zulus-pizza';
const PLAIN_ITEM = 'zp-2'; // MRP 64900 / member 42900, zulus-pizza at HSR

const TOPUP = 200000;
// Phone numbers are unique per run so a previous smoke run cannot occupy them.
const PHONE_SEED = String(Date.now()).slice(-9);
const PHONE = `+919${PHONE_SEED}`;
const PHONE_B = `+918${PHONE_SEED}`;

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

async function signIn(email) {
  return api('POST', '/auth/verify-otp', {
    body: { email, code: '123456', acceptedLegal: true },
  });
}

async function ensureAddress(token, suffix, { lat, lng, pincode, city }) {
  const res = await api('POST', '/addresses/ensure', {
    token,
    body: {
      addressLine: `${suffix} Phase 5 Smoke Road ${RUN}`,
      landmark: 'Phase 5 smoke',
      city,
      pincode,
      lat,
      lng,
      type: 'home',
      label: 'Smoke home',
      isDefault: true,
    },
  });
  return res;
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

function topUp(userId, amount, tag) {
  sql(
    `BEGIN;
     UPDATE users SET "walletBalance" = "walletBalance" + ${amount} WHERE id = '${userId}';
     INSERT INTO wallet_transactions
       ("id","userId","amountInPaise","reason","referenceType","referenceId","createdAt")
     VALUES ('wt-p5-${tag}-${RUN}', '${userId}', ${amount}, 'ADMIN_ADJUSTMENT', 'SMOKE_TEST', '${RUN}', now());
     COMMIT;`,
  );
}

async function placeOrder(token, addressId, key, items, contactPhone) {
  return api('POST', '/orders', {
    token,
    headers: { 'idempotency-key': key },
    body: {
      addressId,
      items,
      useWalletBalancePaise: TOPUP,
      paymentMethod: 'WALLET',
      contactPhone,
    },
  });
}

const PIZZA_WITH_OPTIONS = [
  {
    menuItemId: PIZZA,
    quantity: 1,
    options: [
      { groupId: 'variant', optionName: '12 Inch Cheese Burst' },
      { groupId: 'addons', optionName: 'Extra Mozzarella' },
    ],
  },
];

async function main() {
  console.log('CraveOS Phase 5 customer-product smoke');
  console.log(`  app: ${APP}`);
  console.log(`  api: ${API}\n`);

  // --------------------------------------------------------------- health
  step('1. API is up');
  const health = await api('GET', '/health');
  check('health endpoint responds', health.status === 200, health);

  // ---------------------------------------------------------- fixtures
  step('2. Throwaway customer accounts and address');
  const signupA = await signIn(EMAIL_A);
  check('customer A signs up', signupA.status === 200 && !!signupA.json?.accessToken, signupA);
  const userA = signupA.json?.user;
  const tokenA = signupA.json?.accessToken;

  const signupB = await signIn(EMAIL_B);
  check('customer B signs up', signupB.status === 200 && !!signupB.json?.accessToken, signupB);
  const userB = signupB.json?.user;
  const tokenB = signupB.json?.accessToken;

  check(
    'new account starts on the free trial',
    userA?.membership?.planId === 'plan-trial',
    userA?.membership,
  );
  check('new account has no wallet cash', userA?.walletBalance === 0, userA?.walletBalance);

  const address = await ensureAddress(tokenA, 'HSR', {
    lat: 12.9121,
    lng: 77.6445,
    pincode: '560102',
    city: 'Bengaluru',
  });
  check('HSR address resolves to the HSR hub', address.status < 300 && address.json?.resolvedHubId === HSR_HUB, address);
  const addressId = address.json?.id;

  topUp(userA.id, TOPUP, 'customer');
  check(
    'wallet top-up is ledger-consistent',
    Number(sql(`SELECT "walletBalance" FROM users WHERE id = '${userA.id}';`)) === TOPUP,
  );

  // ------------------------------------------------------ hub-scoped catalog
  step('3. Catalog is scoped to the active hub');
  const hubs = await api('GET', '/catalog/hubs');
  check('public hub list returns at least two hubs', Array.isArray(hubs.json) && hubs.json.length >= 2, hubs);
  const hsrHub = (hubs.json || []).find((hub) => hub.id === HSR_HUB);
  check(
    'HSR hub coordinates are real, not placeholders',
    hsrHub?.lat === 12.9121 && hsrHub?.lng === 77.6445,
    hsrHub,
  );

  const hsrItems = await api('GET', `/catalog/items?hubId=${HSR_HUB}`);
  const indiranagarItems = await api('GET', `/catalog/items?hubId=${INDIRANAGAR_HUB}`);
  const hsrIds = new Set((hsrItems.json || []).map((item) => item.id));
  const indiranagarIds = new Set((indiranagarItems.json || []).map((item) => item.id));

  check('HSR menu includes the HSR pizza row', hsrIds.has(PIZZA), [...hsrIds].slice(0, 5));
  check(
    'Indiranagar menu uses its own row, not the HSR row',
    indiranagarIds.has(PIZZA_INDIRANAGAR) && !indiranagarIds.has(PIZZA),
    { hasIndiranagar: indiranagarIds.has(PIZZA_INDIRANAGAR), hasHsr: indiranagarIds.has(PIZZA) },
  );

  const hsrSearch = await api('GET', `/catalog/search?q=Pepperoni&hubId=${HSR_HUB}`);
  const indiranagarSearch = await api(
    'GET',
    `/catalog/search?q=Pepperoni&hubId=${INDIRANAGAR_HUB}`,
  );
  const hsrSearchIds = new Set((hsrSearch.json || []).map((item) => item.id));
  const indiranagarSearchIds = new Set((indiranagarSearch.json || []).map((item) => item.id));
  check('search honours the HSR hub', hsrSearchIds.has(PIZZA), [...hsrSearchIds]);
  check(
    'search does not leak the other hub row',
    indiranagarSearchIds.has(PIZZA_INDIRANAGAR) && !indiranagarSearchIds.has(PIZZA),
    [...indiranagarSearchIds],
  );

  const brandAtHsr = await api('GET', `/catalog/brands/${MOJO_SLUG}?hubId=${HSR_HUB}`);
  check(
    'brand detail returns only the requested hub kitchen',
    brandAtHsr.status === 200 &&
      Array.isArray(brandAtHsr.json?.brandKitchens) &&
      brandAtHsr.json.brandKitchens.length === 1 &&
      brandAtHsr.json.brandKitchens[0].hubId === HSR_HUB,
    brandAtHsr.json?.brandKitchens?.map((kitchen) => kitchen.hubId),
  );

  // ------------------------------------------------------ variant pricing
  step('4. Variant and add-on pricing is server-authoritative');
  const fullQuote = await api('POST', '/pricing/quote', {
    token: tokenA,
    body: { addressId, items: PIZZA_WITH_OPTIONS },
  });
  const fullLine = fullQuote.json?.lines?.[0];
  check('quote succeeds with a variant and an add-on', fullQuote.status < 300, fullQuote);
  check('12" variant replaces the base price', fullLine?.mrpInPaise === 56800, fullLine);
  check('member price keeps the fixed ₹150 discount', fullLine?.memberPriceInPaise === 41800, fullLine);
  check(
    'quote reports the same member saving',
    fullQuote.json?.amounts?.memberDiscountPaise === 15000,
    fullQuote.json?.amounts,
  );
  check(
    'selected options are echoed with their catalogue prices',
    Array.isArray(fullLine?.options) &&
      fullLine.options.length === 2 &&
      fullLine.options.some((option) => option.groupId === 'variant' && option.name === '12 Inch Cheese Burst') &&
      fullLine.options.some((option) => option.groupId === 'addons' && option.name === 'Extra Mozzarella'),
    fullLine?.options,
  );
  check(
    'member quote has free delivery and packaging',
    fullQuote.json?.amounts?.deliveryFeePaise === 0 &&
      fullQuote.json?.amounts?.packagingFeePaise === 0,
    fullQuote.json?.amounts,
  );
  check(
    'GST is 5% of the member food total',
    fullQuote.json?.amounts?.taxPaise === 2090 &&
      fullQuote.json?.amounts?.grossTotalPaise === 43890,
    fullQuote.json?.amounts,
  );

  const twelveInch = await api('POST', '/pricing/quote', {
    token: tokenA,
    body: {
      addressId,
      items: [
        {
          menuItemId: PIZZA,
          quantity: 1,
          options: [{ groupId: 'variant', optionName: '12 Inch Cheese Burst' }],
        },
      ],
    },
  });
  check(
    'variant-only quote is ₹499 / ₹349',
    twelveInch.json?.lines?.[0]?.mrpInPaise === 49900 &&
      twelveInch.json?.lines?.[0]?.memberPriceInPaise === 34900,
    twelveInch.json?.lines?.[0],
  );

  const tenInch = await api('POST', '/pricing/quote', {
    token: tokenA,
    body: {
      addressId,
      items: [
        {
          menuItemId: PIZZA,
          quantity: 1,
          options: [{ groupId: 'variant', optionName: '10 Inch Pan' }],
        },
      ],
    },
  });
  check(
    '10" variant is ₹349 / ₹199',
    tenInch.json?.lines?.[0]?.mrpInPaise === 34900 &&
      tenInch.json?.lines?.[0]?.memberPriceInPaise === 19900,
    tenInch.json?.lines?.[0],
  );

  const missingVariant = await api('POST', '/pricing/quote', {
    token: tokenA,
    body: { addressId, items: [{ menuItemId: PIZZA, quantity: 1 }] },
  });
  check('an item with variants requires a choice', missingVariant.status === 400, missingVariant);

  const unknownOption = await api('POST', '/pricing/quote', {
    token: tokenA,
    body: {
      addressId,
      items: [
        {
          menuItemId: PIZZA,
          quantity: 1,
          options: [
            { groupId: 'variant', optionName: '12 Inch Cheese Burst' },
            { groupId: 'addons', optionName: 'Truffle Shavings' },
          ],
        },
      ],
    },
  });
  check('an unknown option is rejected', unknownOption.status === 400, unknownOption);

  const clientPrice = await api('POST', '/pricing/quote', {
    token: tokenA,
    body: {
      addressId,
      items: [
        {
          menuItemId: PIZZA,
          quantity: 1,
          options: [
            {
              groupId: 'variant',
              optionName: '12 Inch Cheese Burst',
              priceInPaise: 1,
            },
          ],
        },
      ],
    },
  });
  check('a client-supplied option price is rejected', clientPrice.status === 400, clientPrice);

  // ------------------------------------------------- order + options snapshot
  step('5. Order stores the chosen options and delivery contact');
  const orderA = await placeOrder(
    tokenA,
    addressId,
    `p5-order-a-${RUN}`,
    PIZZA_WITH_OPTIONS,
    PHONE,
  );
  check('order is placed', orderA.status === 201 || orderA.status === 200, orderA);
  check('order totals use the option-adjusted MRP', orderA.json?.mrpTotalPaise === 56800, orderA.json);
  check('order stores the member saving', orderA.json?.memberSavingsPaise === 15000, orderA.json);
  check(
    'wallet covered the whole option-adjusted bill',
    orderA.json?.walletAppliedPaise === 43890 && orderA.json?.finalPaidPaise === 0,
    orderA.json,
  );
  check(
    'delivery contact is normalised and snapshotted',
    orderA.json?.contactPhone === PHONE,
    orderA.json?.contactPhone,
  );
  check('order has a settled payment', orderA.json?.payment?.status === 'SUCCESS', orderA.json?.payment);

  const storedOptions = sql(
    `SELECT "optionsSnapshot"::text FROM order_items WHERE "brandOrderId" IN (
       SELECT id FROM brand_orders WHERE "orderId" = '${orderA.json?.id}'
     );`,
  );
  check(
    'order_items.optionsSnapshot keeps both choices',
    storedOptions.includes('12 Inch Cheese Burst') &&
      storedOptions.includes('Extra Mozzarella') &&
      storedOptions.includes('variant') &&
      storedOptions.includes('addons'),
    storedOptions,
  );

  const readOrderA = await api('GET', `/orders/${orderA.json?.id}`, { token: tokenA });
  check(
    'order read exposes the option snapshot',
    JSON.stringify(readOrderA.json?.brandOrders?.[0]?.items?.[0]?.optionsSnapshot || {}).includes(
      'Extra Mozzarella',
    ),
    readOrderA.json?.brandOrders?.[0]?.items?.[0],
  );

  const orderHistory = await api('GET', `/orders/user/${userA.id}`, { token: tokenA });
  check(
    'order history includes the placed order',
    Array.isArray(orderHistory.json) &&
      orderHistory.json.some((order) => order.id === orderA.json?.id),
    orderHistory.json?.length,
  );

  // --------------------------------------------------------- profile update
  step('6. Profile name and delivery phone are editable');
  const profile = await api('PATCH', '/auth/me', {
    token: tokenA,
    body: { name: 'Phase Five Customer', phone: PHONE_B },
  });
  check('profile update succeeds', profile.status === 200, profile);
  check(
    'phone is stored in +91 form',
    profile.json?.user?.phone === PHONE_B,
    profile.json?.user?.phone,
  );
  check(
    'email remains the account identity',
    profile.json?.user?.email === EMAIL_A,
    profile.json?.user?.email,
  );

  const badPhone = await api('PATCH', '/auth/me', {
    token: tokenA,
    body: { phone: '12345' },
  });
  check('a malformed phone is refused', badPhone.status === 400, badPhone);

  const takenPhone = await api('PATCH', '/auth/me', {
    token: tokenB,
    body: { phone: PHONE_B },
  });
  check('a phone already attached to another account is refused', takenPhone.status === 409, takenPhone);

  const orderAAfterProfile = await api('GET', `/orders/${orderA.json?.id}`, { token: tokenA });
  check(
    'the order keeps the contact used at checkout',
    orderAAfterProfile.json?.contactPhone === PHONE,
    orderAAfterProfile.json?.contactPhone,
  );

  // ------------------------------------------------------ support threading
  step('7. Support ticket is a real threaded conversation');
  const ticket = await api('POST', '/tickets', {
    token: tokenA,
    body: {
      orderId: orderA.json?.id,
      category: 'ORDER',
      priority: 'HIGH',
      message: 'The rider could not find my gate. Please call me.',
    },
  });
  check('ticket is created', ticket.status === 201 || ticket.status === 200, ticket);
  const ticketId = ticket.json?.id;
  check('ticket starts OPEN', ticket.json?.status === 'OPEN', ticket.json?.status);

  const ticketRead1 = await api('GET', `/tickets/${ticketId}`, { token: tokenA });
  check(
    'ticket creation stores the first message',
    ticketRead1.json?.messages?.length === 1 &&
      ticketRead1.json.messages[0].body.includes('could not find my gate'),
    ticketRead1.json?.messages,
  );

  const reply = await api('POST', `/tickets/${ticketId}/messages`, {
    token: tokenA,
    body: { message: 'I am standing at the main gate now.' },
  });
  check('customer can reply', reply.status < 300, reply);

  const otherRead = await api('GET', `/tickets/${ticketId}`, { token: tokenB });
  check('another customer cannot read the thread', otherRead.status === 403, otherRead);

  const otherReply = await api('POST', `/tickets/${ticketId}/messages`, {
    token: tokenB,
    body: { message: 'Let me in on this ticket.' },
  });
  check('another customer cannot reply to the thread', otherReply.status === 403, otherReply);

  const support = await signIn(SUPPORT_EMAIL);
  check(
    'support admin signs in',
    support.status === 200 && support.json?.user?.role === 'ADMIN',
    support.json?.user,
  );
  const supportToken = support.json?.accessToken;
  const supportId = support.json?.user?.id;

  const supportReply = await api('POST', `/tickets/${ticketId}/messages`, {
    token: supportToken,
    body: { message: 'Thanks for the details. I have asked the rider to call you.' },
  });
  check('support can reply', supportReply.status < 300, supportReply);
  check('support reply is attributed to admin', supportReply.json?.authorType === 'ADMIN', supportReply.json);

  const assign = await api('PATCH', `/tickets/${ticketId}/assign`, {
    token: supportToken,
    body: { staffId: supportId },
  });
  check('ticket is assigned to support', assign.status < 300 && assign.json?.status === 'ASSIGNED', assign);

  const resolved = await api('PATCH', `/tickets/${ticketId}/resolve`, {
    token: supportToken,
    body: { resolutionNote: 'Rider called the customer and completed the delivery.' },
  });
  check(
    'ticket is resolved with a visible note',
    resolved.status < 300 &&
      resolved.json?.status === 'RESOLVED' &&
      resolved.json?.resolutionNote.includes('Rider called'),
    resolved,
  );

  const ticketRead2 = await api('GET', `/tickets/${ticketId}`, { token: tokenA });
  check(
    'the thread keeps all three messages in order',
    ticketRead2.json?.messages?.length === 3 &&
      ticketRead2.json.messages[0].authorType === 'CUSTOMER' &&
      ticketRead2.json.messages[1].authorType === 'CUSTOMER' &&
      ticketRead2.json.messages[2].authorType === 'ADMIN',
    ticketRead2.json?.messages?.map((message) => message.authorType),
  );
  check(
    'the customer sees the resolution',
    ticketRead2.json?.resolutionNote.includes('Rider called'),
    ticketRead2.json?.resolutionNote,
  );

  const replyAfterResolve = await api('POST', `/tickets/${ticketId}/messages`, {
    token: tokenA,
    body: { message: 'One more thing.' },
  });
  check('a resolved ticket refuses new messages', replyAfterResolve.status === 400, replyAfterResolve);

  const otherTicketList = await api('GET', `/tickets/user/${userA.id}`, { token: tokenB });
  check('another customer cannot list the owner’s tickets', otherTicketList.status === 403, otherTicketList);

  // ------------------------------------------------------------- reviews
  step('8. Reviews require a delivered order and human moderation');
  sql(`UPDATE orders SET status = 'DELIVERED' WHERE id = '${orderA.json?.id}';`);

  const shortReview = await api('POST', '/reviews', {
    token: tokenA,
    body: { orderId: orderA.json?.id, body: 'Too short' },
  });
  check('a too-short review is refused', shortReview.status === 400, shortReview);

  const otherReview = await api('POST', '/reviews', {
    token: tokenB,
    body: { orderId: orderA.json?.id, body: 'Trying to review someone else’s order.' },
  });
  check('another customer cannot review the order', otherReview.status === 403, otherReview);

  const reviewBody =
    `The pepperoni pizza arrived hot, the cheese burst crust was crisp, and the rider called before arriving. ${RUN}`;
  const review = await api('POST', '/reviews', {
    token: tokenA,
    body: { orderId: orderA.json?.id, body: reviewBody },
  });
  check('a delivered order accepts one review', review.status === 201 || review.status === 200, review);
  check('the review starts PENDING', review.json?.status === 'PENDING', review.json?.status);

  const duplicateReview = await api('POST', '/reviews', {
    token: tokenA,
    body: { orderId: orderA.json?.id, body: 'A second review for the same order.' },
  });
  check('a second review for the same order is refused', duplicateReview.status === 409, duplicateReview);

  const pendingPublic = await api('GET', `/reviews/brands/${MOJO_SLUG}`);
  check(
    'a pending review is not public yet',
    !(pendingPublic.json?.reviews || []).some((item) => item.body === reviewBody),
    pendingPublic.json,
  );

  const myReview = await api('GET', `/reviews/orders/${orderA.json?.id}`, { token: tokenA });
  check(
    'the customer sees their own pending status',
    myReview.json?.review?.status === 'PENDING',
    myReview.json,
  );

  const admin = await signIn(ADMIN_EMAIL);
  check(
    'operations admin signs in',
    admin.status === 200 && admin.json?.user?.role === 'ADMIN',
    admin.json?.user,
  );
  const adminToken = admin.json?.accessToken;

  const moderationQueue = await api('GET', '/reviews/moderation?status=PENDING', {
    token: adminToken,
  });
  check(
    'the moderation queue contains the review',
    Array.isArray(moderationQueue.json?.reviews) &&
      moderationQueue.json.reviews.some((item) => item.id === review.json?.id),
    moderationQueue.json?.reviews?.length,
  );

  const approve = await api('PATCH', `/reviews/${review.json?.id}/moderate`, {
    token: adminToken,
    body: { status: 'APPROVED', note: 'Verified purchase, no policy issue.' },
  });
  check('a review can be approved', approve.status === 200 && approve.json?.status === 'APPROVED', approve);

  const approveAgain = await api('PATCH', `/reviews/${review.json?.id}/moderate`, {
    token: adminToken,
    body: { status: 'REJECTED' },
  });
  check('moderation is one-way', approveAgain.status === 409, approveAgain);

  const approvedPublic = await api('GET', `/reviews/brands/${MOJO_SLUG}`);
  const publicEntry = (approvedPublic.json?.reviews || []).find((item) => item.body === reviewBody);
  check('an approved review becomes public', !!publicEntry, approvedPublic.json);
  check(
    'the public author is anonymised',
    publicEntry?.author === 'Verified customer',
    publicEntry?.author,
  );
  check(
    'the approval is audited',
    sql(`SELECT count(*) FROM audit_logs WHERE action = 'REVIEW_APPROVED' AND "recordId" = '${review.json?.id}';`) === '1',
  );

  const myReviewApproved = await api('GET', `/reviews/orders/${orderA.json?.id}`, { token: tokenA });
  check(
    'the customer sees the approved status',
    myReviewApproved.json?.review?.status === 'APPROVED',
    myReviewApproved.json,
  );

  // --------------------------------------- second order: accepted + rejected
  step('9. Kitchen acceptance emails once and a rejected review stays hidden');
  const orderB = await placeOrder(
    tokenA,
    addressId,
    `p5-order-b-${RUN}`,
    [{ menuItemId: PLAIN_ITEM, quantity: 1 }],
    PHONE,
  );
  check('second order is placed', orderB.status < 300, orderB);
  check(
    'plain item has no option snapshot',
    orderB.json?.brandOrders?.[0]?.items?.[0]?.optionsSnapshot === null ||
      orderB.json?.brandOrders?.[0]?.items?.[0]?.optionsSnapshot === undefined,
    orderB.json?.brandOrders?.[0]?.items?.[0],
  );

  const ticketIds = sql(
    `SELECT id FROM brand_orders WHERE "orderId" = '${orderB.json?.id}' ORDER BY id;`,
  )
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);

  for (const brandTicketId of ticketIds) {
    const accepted = await api('PATCH', `/orders/brand-tickets/${brandTicketId}/status`, {
      token: adminToken,
      body: { status: 'ACCEPTED' },
    });
    check(`kitchen accepts ticket ${brandTicketId.slice(0, 8)}`, accepted.status < 300, accepted);
  }

  const acceptedRows = sql(
    `SELECT status FROM notification_logs WHERE "orderId" = '${orderB.json?.id}' AND kind = 'ORDER_ACCEPTED';`,
  )
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);
  check('kitchen acceptance records one notification row', acceptedRows.length === 1, acceptedRows);
  check(
    'the acceptance row is a real outcome',
    ['SENT', 'SKIPPED', 'FAILED'].includes(acceptedRows[0]),
    acceptedRows,
  );

  // Re-entering the all-accepted branch must not send again.
  for (const brandTicketId of ticketIds) {
    await api('PATCH', `/orders/brand-tickets/${brandTicketId}/status`, {
      token: adminToken,
      body: { status: 'PREPARING' },
    });
  }
  const acceptedAfterMoves = sql(
    `SELECT count(*) FROM notification_logs WHERE "orderId" = '${orderB.json?.id}' AND kind = 'ORDER_ACCEPTED';`,
  );
  check('moving tickets on does not resend acceptance', acceptedAfterMoves === '1', acceptedAfterMoves);

  sql(`UPDATE orders SET status = 'DELIVERED' WHERE id = '${orderB.json?.id}';`);

  const rejectedBody =
    `This review should never appear publicly because it contains an unverifiable claim. ${RUN}`;
  const reviewB = await api('POST', '/reviews', {
    token: tokenA,
    body: { orderId: orderB.json?.id, body: rejectedBody },
  });
  check('a second delivered order accepts its own review', reviewB.status < 300, reviewB);

  const reject = await api('PATCH', `/reviews/${reviewB.json?.id}/moderate`, {
    token: adminToken,
    body: { status: 'REJECTED', note: 'Unverifiable claim.' },
  });
  check('a review can be rejected', reject.status === 200 && reject.json?.status === 'REJECTED', reject);

  const rejectedPublic = await api('GET', `/reviews/brands/${ZULUS_SLUG}`);
  check(
    'a rejected review never becomes public',
    !(rejectedPublic.json?.reviews || []).some((item) => item.body === rejectedBody),
    rejectedPublic.json,
  );
  check(
    'the rejection is audited',
    sql(`SELECT count(*) FROM audit_logs WHERE action = 'REVIEW_REJECTED' AND "recordId" = '${reviewB.json?.id}';`) === '1',
  );

  // ---------------------------------------------------- cancellation email
  step('10. Cancellation emails once, and a repeat cancel is a no-op');
  const orderC = await placeOrder(
    tokenA,
    addressId,
    `p5-order-c-${RUN}`,
    [{ menuItemId: PLAIN_ITEM, quantity: 1 }],
    PHONE,
  );
  check('cancellable order is placed', orderC.status < 300, orderC);

  const cancelled = await api('POST', `/orders/${orderC.json?.id}/cancel`, {
    token: tokenA,
    body: { reason: 'Phase 5 smoke cancellation' },
  });
  check('order cancels before the kitchen starts', cancelled.status < 300 && cancelled.json?.status === 'CANCELLED', cancelled);

  const cancelRows = () =>
    sql(
      `SELECT status FROM notification_logs WHERE "orderId" = '${orderC.json?.id}' AND kind = 'CANCELLED';`,
    )
      .split('\n')
      .map((row) => row.trim())
      .filter(Boolean);
  check('cancellation records one notification row', cancelRows().length === 1, cancelRows());

  const cancelledAgain = await api('POST', `/orders/${orderC.json?.id}/cancel`, {
    token: tokenA,
    body: { reason: 'Phase 5 smoke cancellation' },
  });
  check('a repeat cancel is a no-op', cancelledAgain.status < 300, cancelledAgain);
  check('a repeat cancel sends no second email', cancelRows().length === 1, cancelRows());

  // ------------------------------------------------------ membership email
  step('11. Membership purchase emails exactly once');
  const purchase = await api('POST', '/membership/purchase', {
    token: tokenA,
    headers: { 'idempotency-key': `p5-membership-${RUN}` },
    body: { planSlug: 'monthly', paymentMethod: 'WALLET' },
  });
  check('membership purchase succeeds', purchase.status < 300, purchase);
  check('paid plan activates', purchase.json?.membership?.planId === 'plan-monthly', purchase.json);

  const membershipRows = () =>
    sql(
      `SELECT status FROM notification_logs WHERE "userId" = '${userA.id}' AND kind = 'MEMBERSHIP';`,
    )
      .split('\n')
      .map((row) => row.trim())
      .filter(Boolean);
  check('membership purchase records one notification row', membershipRows().length === 1, membershipRows());

  const purchaseRetry = await api('POST', '/membership/purchase', {
    token: tokenA,
    headers: { 'idempotency-key': `p5-membership-${RUN}` },
    body: { planSlug: 'monthly', paymentMethod: 'WALLET' },
  });
  check('membership retry returns the same purchase', purchaseRetry.json?.purchaseId === purchase.json?.purchaseId, purchaseRetry.json);
  check('membership retry sends no second email', membershipRows().length === 1, membershipRows());

  // ----------------------------------------------------- notification audit
  step('12. Notification log is complete and never duplicates a send');
  const lifecycleRows = sql(
    `SELECT "orderId" || ':' || kind || ':' || status
     FROM notification_logs
     WHERE "orderId" IN ('${orderA.json?.id}','${orderB.json?.id}','${orderC.json?.id}')
     ORDER BY "orderId", kind;`,
  )
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);
  const kindsFor = (orderId) =>
    lifecycleRows
      .filter((row) => row.startsWith(`${orderId}:`))
      .map((row) => row.split(':')[1]);

  check('order A has an ORDER_PLACED row', kindsFor(orderA.json?.id).includes('ORDER_PLACED'), lifecycleRows);
  check('order B has ORDER_PLACED and ORDER_ACCEPTED rows', ['ORDER_PLACED', 'ORDER_ACCEPTED'].every((kind) => kindsFor(orderB.json?.id).includes(kind)), lifecycleRows);
  check('order C has ORDER_PLACED and CANCELLED rows', ['ORDER_PLACED', 'CANCELLED'].every((kind) => kindsFor(orderC.json?.id).includes(kind)), lifecycleRows);
  check(
    'every notification row is SENT, SKIPPED or FAILED',
    lifecycleRows.every((row) => ['SENT', 'SKIPPED', 'FAILED'].includes(row.split(':')[2])),
    lifecycleRows,
  );
  check(
    'no order+kind was marked SENT twice',
    sql(
      `SELECT count(*) FROM (
         SELECT "orderId", kind
         FROM notification_logs
         WHERE status = 'SENT' AND "orderId" IS NOT NULL
         GROUP BY "orderId", kind
         HAVING count(*) > 1
       ) duplicates;`,
    ) === '0',
  );

  // --------------------------------------------------------------- honesty
  step('13. Customer routes render as real pages');
  for (const path of ['/', '/menu', '/orders', '/account', '/account/addresses', '/support']) {
    const page = await fetchPage(path);
    check(
      `${path} returns 200 HTML`,
      page.status === 200 && page.contentType.includes('text/html'),
      { status: page.status, contentType: page.contentType },
    );
  }

  const restaurantPage = await fetchPage(`/restaurants/${MOJO_SLUG}`);
  check(
    `restaurant page /restaurants/${MOJO_SLUG} renders`,
    restaurantPage.status === 200 && restaurantPage.contentType.includes('text/html'),
    { status: restaurantPage.status, contentType: restaurantPage.contentType },
  );

  const supportThreadPage = await fetchPage(`/support/${ticketId}`);
  check(
    'support thread page renders',
    supportThreadPage.status === 200 && supportThreadPage.contentType.includes('text/html'),
    { status: supportThreadPage.status, contentType: supportThreadPage.contentType },
  );

  console.log('\n--- fixtures created by this run ---');
  console.log(
    JSON.stringify(
      {
        customer: userA.id,
        otherCustomer: userB.id,
        orders: [orderA.json?.id, orderB.json?.id, orderC.json?.id],
        ticket: ticketId,
        reviews: [review.json?.id, reviewB.json?.id],
        email: EMAIL_A,
      },
      null,
      2,
    ),
  );
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nPHASE 5 SMOKE TEST ABORTED');
  console.error(err);
  process.exitCode = 1;
});
