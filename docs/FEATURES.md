# Feature Registry

This file is the single source of truth for **what the product actually does**.
It exists because the codebase previously shipped screens that looked real but
were backed by mock arrays, hardcoded copy, or client-side guesses.

## The contract

Every customer-visible claim must trace a complete chain:

```
UI element -> API endpoint -> database row -> verification
```

If any link is missing, the feature is **not LIVE** and its entry point must be
hidden or deleted. A dead button, a "coming soon" toast, or a screen fed by a
mock array is a release blocker.

### Status values

| Status | Meaning | Allowed in navigation? |
| --- | --- | --- |
| `LIVE` | Reachable in the UI and backed by API + DB. | Yes |
| `API` | Real endpoint/worker exists but has no customer UI yet. | No |
| `HIDDEN` | Code may exist, but no route, nav item, or link reaches it. | No |
| `PLANNED` | Not built. Must not appear anywhere in the UI. | No |
| `REMOVED` | Deleted on purpose. Do not resurrect without a new registry row. | No |

`LIVE` and `API` rows require a non-empty **Source** and **Verification**.
`scripts/check-no-fakes.mjs` enforces this table and the banned patterns below.

## Customer features

| Feature | Status | Surface | Source of truth | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| Email OTP sign-in | LIVE | `src/components/AuthModal.tsx` | `POST /auth/request-otp`, `POST /auth/verify-otp`; Redis OTP + `User` | Manual: request code, verify, reload session | Dev bypass requires `DEV_OTP_BYPASS=true`; no client-side fallback code |
| Session persistence | LIVE | `src/context/UserContext.tsx` | JWT from `verify-otp`; `localStorage` | Manual: reload keeps session; logout clears | Token storage moves to httpOnly cookies in Phase 3 |
| Brand catalogue | LIVE | `src/views/HomeScreen.tsx`, `MenuScreen.tsx` | `GET /catalog/brands`, `GET /catalog/brands/:slug`; `Brand`, `BrandKitchen` | Manual: brands render from API only | No mock fallback |
| Menu catalogue | LIVE | `src/views/MenuScreen.tsx` | `GET /catalog/items`; `MenuItem` | Manual: items render from API only | Prices in paise from DB |
| Item search | LIVE | `src/views/SearchScreen.tsx` | `GET /catalog/search?q=`; `MenuItem` | Manual: query returns DB matches | Debounced, abortable |
| Serviceability lookup | LIVE | `src/views/HomeScreen.tsx`, `SavedAddressModal.tsx` | `POST /catalog/serviceability/resolve`; `Hub.servicePolygon` | Manual: HSR address resolves `hub-hsr-01` | ETA is not advertised until measured |
| Cart | LIVE | `src/components/CartSidebar.tsx`, `src/context/CartContext.tsx` | Client state only; no DB row until checkout | Manual: add/remove/quantity/persist | Shows MRP only; member price, fees, GST and wallet cap come from the server quote |
| Checkout quote | LIVE | `src/views/CheckoutScreen.tsx` | `POST /pricing/quote`; `MenuItem`, `Membership`, `Promotion`, `PromotionRedemption`, `User.walletBalance` | Manual: quote matches the order total for the same cart | Requires an authenticated customer and a saved address; amounts are paise |
| Order placement (UPI/CARD) | LIVE | `src/views/CheckoutScreen.tsx` | `POST /orders`, `POST /payments/create-razorpay-order`, `POST /payments/verify`; `Order`, `Payment`, `PromotionRedemption` | Manual: Razorpay test payment creates paid order | Order total is recomputed inside the order transaction; COD removed |
| Order placement (wallet) | LIVE | `src/views/CheckoutScreen.tsx` | `POST /orders`; `User.walletBalance`, `WalletTransaction` | Manual: wallet debit is atomic and visible | Wallet may only cover part of a bill; the gateway collects the remainder |
| Order tracking | LIVE | `src/views/OrdersScreen.tsx` | `GET /orders/:id`, `GET /orders/user/:userId`; Socket.IO | Manual: status changes propagate live | Poll fallback exists |
| Order cancellation | API | none | `POST /orders/:id/cancel`; `Order`, refund ledger | Manual: cancel before pickup refunds correctly | Automatic cancellation only when a payment modal is dismissed; no customer cancel button yet |
| Address book | LIVE | `src/components/SavedAddressModal.tsx` | `GET/POST/PATCH/DELETE /addresses`; `Address` | Manual: create, edit, delete, select | |
| Wallet balance and ledger | LIVE | `src/views/ProfileScreen.tsx` | `GET /payments/wallet/:userId`; `WalletTransaction` | Manual: balance equals ledger sum | Includes order spend/refund, membership purchase and referral reward rows |
| Customer support ticket creation | API | none | `POST /tickets`, `GET /tickets/user/:userId`; `Ticket` | Manual: API creates and reads a ticket | No customer-facing ticket form yet |
| Order invoice email | API | `apps/api/src/modules/notifications` | Resend; `Order` | Manual: delivered to `DEV_EMAIL_RECIPIENT` in dev | No UI toggle |
| Membership free trial (auto-enrol) | LIVE | `src/views/ProfileScreen.tsx` | `Membership` with `plan-trial`, `startedAt`/`endsAt`; `GET /auth/me`, `GET /membership/me` | Manual: new user gets a 30-day trial; profile shows the plan and expiry | Trial starts at signup; no wallet cash is issued |
| Membership purchase and renewal | LIVE | `src/views/ProfileScreen.tsx` | `GET /membership/plans`, `GET /membership/me`, `POST /membership/purchase`, `POST /membership/purchase/verify`; `MembershipPlan`, `Membership`, `MembershipPurchase` | Manual: buy with wallet and with Razorpay test mode; expiry extends; renewal extends the current expiry | Buying during trial starts the paid plan immediately and forfeits remaining trial days; no auto-renewal |
| Membership enforcement | LIVE | `src/views/CheckoutScreen.tsx` | `POST /pricing/quote` reads the active `Membership` row | Manual: member quote uses member prices and zero delivery/packaging; expired membership does not | Membership is evaluated from `endsAt` on every quote |
| Referral attribution and reward | LIVE | `src/components/AuthModal.tsx`, `src/views/ProfileScreen.tsx` | `POST /auth/verify-otp` accepts `referralCode`; `GET /referrals/me`; `Referral`, `WalletTransaction` | Manual: signup with a code, deliver the first order, both wallets are credited | ₹100 referrer / ₹50 referee; reward only after the referee's first delivered order; 20 rewarded referrals per referrer |
| Ratings and reviews | PLANNED | none | no `Review` model | none | Ratings are hidden; do not invent them |
| Deals and promotions page | HIDDEN | none | `Promotion`, `PromotionRedemption`; `GET /pricing/offers/active` returns approved in-window rows only | `check-no-fakes` keeps the route hidden | Coupon codes apply at checkout; the customer Deals surface stays hidden until the generic engine is exposed |
| AI assistant | REMOVED | none | none | `check-no-fakes` | Deleted in Phase 0 |
| Cash on delivery | REMOVED | none | none | `check-no-fakes` | Deleted in Phase 0 |
| Checkout sign-in with email OTP | LIVE | `src/components/AuthModal.tsx`, `src/views/CheckoutScreen.tsx` | `POST /auth/request-otp`, `POST /auth/verify-otp`, `POST /orders`; `User`, `Otp` in Redis | Manual: new email verifies an OTP and can place an order | Email-first account creation at checkout; phone is optional and only used as a delivery contact |
| ONDC integration | PLANNED | none | none | none | Post-v1 |

## Operator features

| Feature | Status | Surface | Source of truth | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| Platform dashboard | LIVE | `src/views/admin/AdminDashboardView.tsx` | `GET /admin/dashboard/*`; `Order`, `Payment` | Manual: KPIs match seeded orders | |
| User administration | LIVE | `src/views/AdminPlatformView.tsx` | `GET /admin/users`, `PATCH /admin/users/:id/block`, `DELETE /admin/users/:id` | Manual: block/unblock reflected at login | |
| Order administration | LIVE | `src/views/AdminPlatformView.tsx` | `GET /admin/orders`, `POST /admin/orders/:id/reassign-rider` | Manual: reassignment updates trip | |
| Refunds | LIVE | `src/views/AdminPlatformView.tsx` | `POST /admin/orders/:id/refund`; `Payment`, `WalletTransaction` | Manual: refund is idempotent and audited | |
| Hub management | LIVE | `src/views/AdminPlatformView.tsx` | `POST/PATCH /admin/hubs`; `Hub` | Manual: create/edit hub | |
| Brand management | LIVE | `src/views/AdminPlatformView.tsx` | `POST/PATCH /admin/brands`; `Brand` | Manual: create/edit brand | |
| Rider payouts | LIVE | `src/views/AdminPlatformView.tsx` | `GET/POST /admin/finance/rider-payouts`; `RiderEarning` | Manual: batch payout marks earnings paid | |
| Audit log | LIVE | `src/views/AdminPlatformView.tsx` | `GET /admin/audit-log`; `AuditLog` | Manual: privileged actions appear | |
| Promotion administration | LIVE | `src/views/AdminPlatformView.tsx` | `GET /admin/promotions`, `POST /admin/promotions`, `PATCH /admin/promotions/:id/status`; `Promotion` | Manual: create an approved code, reject a brand proposal, redeem the code at checkout | Only `APPROVED` rows inside their window apply; every redemption writes `PromotionRedemption` |
| Support ticket desk | LIVE | `src/views/admin/AdminTicketsView.tsx` | `GET /tickets`, `PATCH /tickets/:id/assign`, `PATCH /tickets/:id/status`, `PATCH /tickets/:id/resolve`; `Ticket` | Manual: assign, resolve and close a ticket | Operator-only |
| Hub operations dashboard | LIVE | `src/views/HubOpsView.tsx` | `GET /hub-ops/:hubId/dashboard` | Manual: scoped to caller's hub | |
| Stock and 86-ing | LIVE | `src/views/HubOpsView.tsx` | `GET /hub-ops/:hubId/stock`, `PATCH /hub-ops/:hubId/stock/bulk-86`; `MenuItem` | Manual: 86 hides item for that hub | |
| Kitchen display system | LIVE | `src/views/AdminKDSView.tsx` | `GET /hub-ops/:hubId/kds/tickets`, `PATCH /orders/brand-tickets/:ticketId/status`; `BrandOrder` | Manual: ticket advances through states | |
| Dispatch and rider handoff | LIVE | `src/views/AdminDispatchView.tsx` | `POST /logistics/auto-assign/:orderId`, `POST /hub-ops/:hubId/rider-handoff/:tripId`; `DeliveryTrip` | Manual: trip created and assigned | |
| Rider onboarding and approval | LIVE | `src/views/admin/AdminRiderManagementView.tsx` | `POST /riders/register`, `GET /riders/approval-queue`, `PATCH /riders/:id/status`; `Rider` | Manual: pending rider approved | Rider sign-in currently requires `DEV_OTP_BYPASS`; see launch gate 8 |
| Rider console | LIVE | `src/views/RiderConsoleView.tsx` | `GET /logistics/trips/rider/:riderId/active`, trip transition endpoints | Manual: accept, pickup, deliver | |
| Brand operations dashboard | LIVE | `src/views/BrandOpsView.tsx` | `GET /brand-ops/:brandId/dashboard` | Manual: scoped to caller's brand | |
| Brand menu management | LIVE | `src/views/BrandOpsView.tsx` | `GET/POST/PATCH/DELETE /brand-ops/:brandId/menu/*`; `MenuItem` | Manual: price and availability edits persist | |
| Brand promotion proposals | LIVE | `src/views/BrandOpsView.tsx` | `POST /brand-ops/:brandId/promotions/propose`; `Promotion` with `PENDING_APPROVAL` | Manual: submit a code, see it in the admin approval queue, approve it, redeem it | Brand ops cannot approve its own proposal |
| Brand analytics and finance | LIVE | `src/views/BrandOpsView.tsx` | `GET /brand-ops/:brandId/analytics`, `GET /brand-ops/:brandId/finance` | Manual: totals reconcile with orders | |

## Platform

| Feature | Status | Surface | Source of truth | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| Health and readiness probe | API | none | `GET /api/v1/health`; live PostgreSQL `SELECT 1` and Redis `PING` | CI: `npm run check:api-health` returns `200` with both checks `up` | Public; returns `503` when either dependency is down; no secrets in the response |
| Production startup guard | API | none | `apps/api/src/common/config/env.validation.ts` | CI: `npm run check:prod-guard` rejects an example secret, localhost origin and `DEV_OTP_BYPASS=true` | Process exits before listening on an unsafe production configuration |
| Database migrations | API | none | `prisma/migrations/0_init`; `prisma migrate deploy` | CI applies migrations to a fresh PostgreSQL 16 database | `db push` is forbidden for databases with real data; see `docs/OPERATIONS.md` |

## Removed in Phase 0

These were deleted because they were not backed by a real chain. Do not
reintroduce them without a registry row, an API, a database source, and a
verification step.

- `src/data/mockData.ts` and every `MOCK_*` import or fallback.
- `src/components/AICraveAssistantModal.tsx` and the `@google/genai` dependency.
- `src/views/MembershipScreen.tsx` and every membership nav entry. Membership is
  now a real purchase inside `ProfileScreen`.
- The customer Deals route and nav entry. The `Promotion` engine is live behind
  checkout coupon codes, but the Deals surface stays hidden until it is exposed.
- The `PricingRule` model and `POST /pricing/calculate`. Quotes now come from
  `POST /pricing/quote` and promotions from `Promotion`.
- Cash-on-delivery as a payment method, API branch, and database value.
- Hardcoded ratings, review counts, delivery ETAs, savings figures, coupon
  banners, "Happy Hours Live" copy, and prefilled demo credentials.

## Launch gates

The product must not be deployed to customers until all of these are true:

1. `npm run check:no-fakes` passes with zero findings.
2. Every `LIVE` row above has been exercised against the production-like
   database and its verification step recorded.
3. Legal pages contain real values, not `{{PLACEHOLDER}}` tokens:
   registered entity name, registered address, FSSAI licence, GSTIN, grievance
   officer name, email, phone, and response window.
4. Razorpay is in live mode with webhook signature verification enabled.
5. Resend has a verified sending domain configured in `RESEND_FROM_EMAIL`;
   OTP delivery is not dependent on `DEV_OTP_BYPASS`.
6. Rider sign-in has a real email channel. Until then, rider OTP requests
   return 503 outside the development bypass.
7. Database backups and restore drills are in place.
8. A rollback path exists for every deploy.
9. The production startup guard passes with `NODE_ENV=production`, a strong
   `JWT_SECRET`, explicit HTTPS origins and `DEV_OTP_BYPASS` off.
10. `/api/v1/health` returns `200` with PostgreSQL and Redis both `up`, and an
    external uptime monitor polls it.
11. The money ledger reconciles: wallet balance equals the sum of
    `WalletTransaction` rows, membership purchases match gateway settlements,
    referral rewards only exist for delivered orders, and no `WELCOME_BONUS`
    cash is issued to new accounts.
12. Every advertised coupon exists as an `APPROVED` `Promotion` inside its
    window. No offer may be shown from copy alone.

## How to add a feature

1. Add a row with status `PLANNED`.
2. Build the database model, API, and UI.
3. Add a verification step that a second person can run.
4. Change the status to `LIVE` only when the whole chain works.
5. If you cannot finish it, delete the entry point and leave the row `PLANNED`.

Reviewers should reject any PR that adds a visible claim without updating this
file.
