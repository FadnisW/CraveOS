# Legal and policy operations

This document explains how the customer-facing legal surfaces are built, what
must be true before they can be published, and how to change them without
creating a gap between the published contract and what the product actually
does.

The pages are a working draft. They describe the product's real behaviour, but
they are **not a substitute for advice from an Indian food, consumer-protection
and data-protection lawyer**. Counsel review is a launch requirement, not a
nice-to-have.

## 1. What exists

| Surface | Route | Source |
| --- | --- | --- |
| Policy index | `/legal` | `app/legal/page.tsx` |
| Terms of Service | `/legal/terms` | `app/legal/terms/page.tsx` |
| Privacy Policy | `/legal/privacy` | `app/legal/privacy/page.tsx` |
| Refunds & cancellations | `/legal/refunds` | `app/legal/refunds/page.tsx` |
| Delivery terms | `/legal/delivery` | `app/legal/delivery/page.tsx` |
| Contact & grievance | `/legal/contact` | `app/legal/contact/page.tsx` |

The shared shell is `app/legal/layout.tsx`. The storefront footer
(`src/components/Footer.tsx`) links to every page.

`src/lib/legal.ts` is the single source of truth for the legal identity, the
policy version and placeholder detection. The API's
`apps/api/src/modules/auth/auth.service.ts` carries the same
`LEGAL_POLICY_VERSION` constant, and `scripts/check-legal-identity.mjs` fails if
the two drift.

## 2. Identity values

The pages never hardcode an entity name, address, registration number or
contact. Each value comes from the environment:

| Variable | Rendered as | Validation in the release gate |
| --- | --- | --- |
| `NEXT_PUBLIC_LEGAL_ENTITY_NAME` | Operator name | At least 2 characters |
| `NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS` | Registered address | At least 10 characters |
| `NEXT_PUBLIC_LEGAL_JURISDICTION` | Governing-law courts | At least 2 characters |
| `NEXT_PUBLIC_LEGAL_FSSAI_LICENCE` | FSSAI licence | Exactly 14 digits |
| `NEXT_PUBLIC_LEGAL_GSTIN` | GSTIN | 15-character GSTIN pattern |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Support email | Valid email address |
| `NEXT_PUBLIC_SUPPORT_PHONE` | Support phone | At least 10 digits |
| `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` | Grievance officer | At least 2 characters |
| `NEXT_PUBLIC_GRIEVANCE_OFFICER_EMAIL` | Grievance email | Valid email address |
| `NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE` | Grievance phone | At least 10 digits |

The values are `NEXT_PUBLIC_*` because they render on the server and in the
browser. They are identity data, not secrets. Do not put a private key, a bank
detail or a personal home address here; use the registered business address.

Because the legal pages are statically prerendered, these values are embedded
at **build time**. After changing a legal value or a policy page, rebuild the
storefront; editing `.env` on a running production server will not change a
page that was already built.

### Placeholder behaviour

When a value is absent, `src/lib/legal.ts` substitutes a marker such as
`{{LEGAL_ENTITY_NAME}}`. `LegalValue` renders that marker with an amber
highlight and a tooltip, and every legal page shows a banner naming the missing
fields. This is deliberate:

- a page never silently presents an invented entity as if it were real;
- a developer can see exactly what is missing;
- the release gate refuses to build a production artifact until the list is
  empty.

The legal layout also sets `robots: { index: false, follow: false }` while the
text is a draft. Remove or invert that once counsel has approved the final text.

### Release gate

```bash
npm run check:legal            # advisory, exits 0 and lists missing fields
npm run check:legal:release    # blocking, exits 1 on any missing/invalid field
npm run build:release          # check:legal:release && next build
npm run start:release          # check:legal:release && next start
```

`npm run verify` runs the advisory form so local work is not blocked while the
business collects the values. CI runs the blocking form in the release
workflow (`.github/workflows/release-gate.yml`) before a tagged build.

The release workflow reads the values from repository secrets:

| Secret |
| --- |
| `LEGAL_ENTITY_NAME` |
| `LEGAL_REGISTERED_ADDRESS` |
| `LEGAL_JURISDICTION` |
| `LEGAL_FSSAI_LICENCE` |
| `LEGAL_GSTIN` |
| `SUPPORT_EMAIL` |
| `SUPPORT_PHONE` |
| `GRIEVANCE_OFFICER_NAME` |
| `GRIEVANCE_OFFICER_EMAIL` |
| `GRIEVANCE_OFFICER_PHONE` |

A missing secret becomes an empty value, so the release fails rather than
shipping a placeholder. The workflow also requires `NEXT_PUBLIC_APP_URL` as a
secret so the production build carries the real HTTPS origin.

The gate checks three things, not one:

1. every value is present and not a `{{PLACEHOLDER}}`;
2. every value matches the expected shape (a GSTIN is not a phone number);
3. the policy version in the web app matches the policy version in the API.

## 3. Consent

New accounts must tick a box accepting the Terms of Service and Privacy Policy.
The box is in `src/components/AuthModal.tsx` and is not pre-ticked. The verify
button stays disabled until it is ticked, and the API independently refuses a
new account when `acceptedLegal !== true`.

On success the API stores:

| Column | Value |
| --- | --- |
| `User.termsAcceptedAt` | Timestamp of acceptance |
| `User.termsVersion` | `LEGAL_POLICY_VERSION` at the time |
| `User.privacyAcceptedAt` | Timestamp of acceptance |
| `User.privacyVersion` | `LEGAL_POLICY_VERSION` at the time |

Existing accounts created before consent capture are backfilled the next time
their owner signs in with the box ticked. The API itself allows an existing
account to sign in without the box — consent is required to create the
contract, not to re-enter an existing one — but the storefront asks every email
sign-in to tick it so pre-Phase-4 accounts are backfilled rather than left
without a recorded acceptance.

### Policy-version bump process

1. Change the policy text in `app/legal/*`.
2. Update `LEGAL_POLICY_VERSION` and `LEGAL_LAST_UPDATED` in `src/lib/legal.ts`.
3. Update `LEGAL_POLICY_VERSION` in `apps/api/src/modules/auth/auth.service.ts`
   to the same value. The gate fails on drift.
4. Decide whether the change is material. If it is, add a re-consent step before
   the new version applies; do not silently rewrite the contract behind an
   existing account.
5. Run `npm run check:legal` and `npm run check:legal-smoke`.
6. Commit the text, both version constants and any consent-flow change together.

Do not bump the version for a typo fix that does not change meaning. Do bump it
for a change to refunds, retention, sharing, membership or liability.

## 4. The product promises the pages make

These are the choices the code and the text share. Changing one without the
other makes the page false.

### Cancellation

- A customer may cancel while every kitchen ticket is still `SENT_TO_KITCHEN`
  and no rider is assigned.
- Cancellation closes as soon as any ticket is `ACCEPTED`, `PREPARING` or
  `READY`, or a rider is assigned.
- A paid order is refunded in full. A wallet payment returns to the wallet
  immediately. A gateway payment returns through Razorpay to the original
  instrument, typically in 5–7 working days. A mixed payment returns both
  components.
- An unpaid order is closed without a refund.
- The coupon used on a cancelled order is released.
- The refund is idempotent: the order row is locked and a second cancel returns
  the already-cancelled order without moving money again.

### Memberships

- Plans are prepaid and do not auto-renew.
- All plans include member pricing and free delivery and packaging.
- Buying a paid plan during the trial starts it immediately and forfeits the
  remaining trial days. The purchase screen states this before confirmation.
- A renewal extends from the current paid expiry.
- Fees are refundable only for a duplicate or unauthorised charge, or where law
  requires it. There is no pro-rata refund after the plan starts.

### Referrals

- ₹100 to the referrer and ₹50 to the referee after the referee's first
  delivered order.
- At most 20 rewarded referrals per referrer; beyond the cap the referee still
  receives ₹50.
- Rewards are wallet credit, not withdrawable cash.
- A reward may be reversed by support through the wallet ledger if the
  qualifying order is refunded, cancelled or found to be abusive. The automatic
  flows only reward after delivery, so an order cancelled before delivery never
  earns a reward in the first place.

### Data retention

- Account and profile data: name, email, phone, cart, saved addresses not
  attached to an order, and the current membership are deleted or anonymised
  within 30 days of a verified deletion request.
- A deletion request is refused while wallet credit remains or a live order
  exists. Support helps the customer spend or resolve the credit first; the
  endpoint never zeroes a wallet balance.
- Order, invoice, payment and tax records, including the delivery address
  attached to an order: retained for 8 years.
- Pending referrals are cancelled on deletion so no reward is paid to an
  anonymised account. Rewarded referrals remain as financial history.
- Support tickets stay linked to the anonymised account for dispute and audit
  use.
- OTP codes: 10 minutes. Rate-limit counters: 15 minutes. Revoked session ids:
  until the token would have expired.

### Account deletion

`DELETE /admin/users/:id` is the only deletion path. It is restricted to a
super admin and writes a `USER_ANONYMIZED` audit entry. It refuses with `409`
when the account still has wallet credit or a live order, and it refuses to let
an admin delete the account they are signed in with.

On success it cancels pending referrals, deletes the cart, deletes saved
addresses that were never attached to an order, deletes the current membership,
replaces the name, email and phone with anonymised values, clears the referrer
link, blocks the account so existing HTTP and WebSocket sessions stop working,
and keeps the financial records listed above. A second call returns the same
anonymised account instead of writing another audit entry.

The 30-day promise starts when support has verified that the requester controls
the account. Record the request date, the verification, any wallet or live-order
blocker, and the completion date in the support ticket.

### Grievance

- Acknowledge within 48 hours.
- Resolve within 30 days, or explain why more time is needed and give a new date.
- The grievance officer is a named person with a monitored mailbox and phone.

## 5. Launch checklist

- [ ] Every identity variable is set to a real, verified value.
- [ ] `npm run check:legal:release` exits 0.
- [ ] Counsel has reviewed the Terms, Privacy, Refund, Delivery and Contact
      pages against the actual product.
- [ ] FSSAI licence and GSTIN on the pages match the registrations.
- [ ] The support mailbox and phone are monitored by a named team.
- [ ] The grievance officer has agreed to the 48-hour / 30-day commitment.
- [ ] The consent checkbox is visible, unticked by default, and blocks signup.
- [ ] A test signup stores the timestamps and version in the database.
- [ ] A paid wallet order can be cancelled and refunded exactly once.
- [ ] A cancellation after kitchen acceptance is refused with a clear message.
- [ ] The privacy policy's retention periods match the deletion and finance
      procedures in `docs/OPERATIONS.md`.
- [ ] The `robots: noindex` draft guard has been removed for the approved text.
- [ ] The policy version is identical in `src/lib/legal.ts` and
      `apps/api/src/modules/auth/auth.service.ts`.

## 6. Smoke test

`npm run check:legal-smoke` runs against a live development stack:

```
legal pages -> placeholder honesty -> signup without consent refused
-> consent persisted with the policy version -> existing account still signs in
-> wallet order -> cancel -> one refund -> second cancel is a no-op
-> kitchen acceptance -> cancellation refused
-> kitchen rejection -> order closed, wallet refunded, trip cancelled
-> deletion refused with wallet credit -> operations admin refused
-> super-admin deletion anonymises, blocks the old session, removes profile
   data and is idempotent
```

It needs the Next server on port 3000, the API on port 4000, PostgreSQL and
Redis, `DEV_OTP_BYPASS=true`, the seeded menu and the `craveos-postgres` Docker
container. It creates one throwaway account, attempts one refused signup, and
never mutates existing customers. It is a manual pre-release check, not part of
`npm run verify`.
