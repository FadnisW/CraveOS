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
| Cart | LIVE | `src/components/CartSidebar.tsx`, `src/context/CartContext.tsx` | Client state only; no DB row until checkout | Manual: add/remove/quantity/persist | Shows MRP only; fees are checkout-time |
| Checkout quote | LIVE | `src/views/CheckoutScreen.tsx` | `POST /pricing/calculate`; `MenuItem.mrpInPaise`, `PricingRule` | Manual: quote matches order total | Server quote required before placing |
| Order placement (UPI/CARD) | LIVE | `src/views/CheckoutScreen.tsx` | `POST /orders`, `POST /payments/create-razorpay-order`, `POST /payments/verify`; `Order`, `Payment` | Manual: Razorpay test payment creates paid order | COD removed |
| Order placement (wallet) | LIVE | `src/views/CheckoutScreen.tsx` | `POST /orders`; `User.walletBalance`, `WalletTransaction` | Manual: wallet debit is atomic and visible | Insufficient balance is rejected |
| Order tracking | LIVE | `src/views/OrdersScreen.tsx` | `GET /orders/:id`, `GET /orders/user/:userId`; Socket.IO | Manual: status changes propagate live | Poll fallback exists |
| Order cancellation | API | none | `POST /orders/:id/cancel`; `Order`, refund ledger | Manual: cancel before pickup refunds correctly | Automatic cancellation only when a payment modal is dismissed; no customer cancel button yet |
| Address book | LIVE | `src/components/SavedAddressModal.tsx` | `GET/POST/PATCH/DELETE /addresses`; `Address` | Manual: create, edit, delete, select | |
| Wallet balance and ledger | LIVE | `src/views/ProfileScreen.tsx` | `GET /payments/wallet/:userId`; `WalletTransaction` | Manual: balance equals ledger sum | |
| Customer support ticket creation | API | none | `POST /tickets`, `GET /tickets/user/:userId`; `Ticket` | Manual: API creates and reads a ticket | No customer-facing ticket form yet |
| Order invoice email | API | `apps/api/src/modules/notifications` | Resend; `Order` | Manual: delivered to `DEV_EMAIL_RECIPIENT` in dev | No UI toggle |
| Membership free trial (auto-enrol) | API | none | `User.membership`, `Membership`, `MembershipPlan`; `PricingService.verifyMembership` | Manual: new user gets 30-day trial; quote applies member pricing | Not advertised in UI until purchase/renewal ships |
| Membership purchase and renewal | PLANNED | none | none | none | Phase 2.7 |
| Referral attribution and reward | PLANNED | none | `User.referralCode` exists but is unused | none | Phase 2.8 |
| Ratings and reviews | PLANNED | none | no `Review` model | none | Ratings are hidden; do not invent them |
| Deals and promotions page | HIDDEN | none | `PricingRule` (admin-managed) | `GET /pricing/offers/active` returns DB rows only | Re-enable when checkout applies rules |
| AI assistant | REMOVED | none | none | `check-no-fakes` | Deleted in Phase 0 |
| Cash on delivery | REMOVED | none | none | `check-no-fakes` | Deleted in Phase 0 |
| Guest checkout with email OTP | PLANNED | none | none | none | Phase 2.6 |
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
| Promotion administration | LIVE | `src/views/AdminPlatformView.tsx` | `GET /admin/promotions`, `PATCH /admin/promotions/:id/status`; `PricingRule` | Manual: approve/reject brand proposal | Customer application is Phase 2 |
| Support ticket desk | LIVE | `src/views/admin/AdminTicketsView.tsx` | `GET /tickets`, `PATCH /tickets/:id/assign`, `PATCH /tickets/:id/status`, `PATCH /tickets/:id/resolve`; `Ticket` | Manual: assign, resolve and close a ticket | Operator-only |
| Hub operations dashboard | LIVE | `src/views/HubOpsView.tsx` | `GET /hub-ops/:hubId/dashboard` | Manual: scoped to caller's hub | |
| Stock and 86-ing | LIVE | `src/views/HubOpsView.tsx` | `GET /hub-ops/:hubId/stock`, `PATCH /hub-ops/:hubId/stock/bulk-86`; `MenuItem` | Manual: 86 hides item for that hub | |
| Kitchen display system | LIVE | `src/views/AdminKDSView.tsx` | `GET /hub-ops/:hubId/kds/tickets`, `PATCH /orders/brand-tickets/:ticketId/status`; `BrandOrder` | Manual: ticket advances through states | |
| Dispatch and rider handoff | LIVE | `src/views/AdminDispatchView.tsx` | `POST /logistics/auto-assign/:orderId`, `POST /hub-ops/:hubId/rider-handoff/:tripId`; `DeliveryTrip` | Manual: trip created and assigned | |
| Rider onboarding and approval | LIVE | `src/views/admin/AdminRiderManagementView.tsx` | `POST /riders/register`, `GET /riders/approval-queue`, `PATCH /riders/:id/status`; `Rider` | Manual: pending rider approved | Rider sign-in currently requires `DEV_OTP_BYPASS`; see launch gate 8 |
| Rider console | LIVE | `src/views/RiderConsoleView.tsx` | `GET /logistics/trips/rider/:riderId/active`, trip transition endpoints | Manual: accept, pickup, deliver | |
| Brand operations dashboard | LIVE | `src/views/BrandOpsView.tsx` | `GET /brand-ops/:brandId/dashboard` | Manual: scoped to caller's brand | |
| Brand menu management | LIVE | `src/views/BrandOpsView.tsx` | `GET/POST/PATCH/DELETE /brand-ops/:brandId/menu/*`; `MenuItem` | Manual: price and availability edits persist | |
| Brand analytics and finance | LIVE | `src/views/BrandOpsView.tsx` | `GET /brand-ops/:brandId/analytics`, `GET /brand-ops/:brandId/finance` | Manual: totals reconcile with orders | |

## Removed in Phase 0

These were deleted because they were not backed by a real chain. Do not
reintroduce them without a registry row, an API, a database source, and a
verification step.

- `src/data/mockData.ts` and every `MOCK_*` import or fallback.
- `src/components/AICraveAssistantModal.tsx` and the `@google/genai` dependency.
- `src/views/MembershipScreen.tsx` and every membership nav entry.
- The customer Deals route and nav entry (promotion engine is Phase 2).
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

## How to add a feature

1. Add a row with status `PLANNED`.
2. Build the database model, API, and UI.
3. Add a verification step that a second person can run.
4. Change the status to `LIVE` only when the whole chain works.
5. If you cannot finish it, delete the entry point and leave the row `PLANNED`.

Reviewers should reject any PR that adds a visible claim without updating this
file.
