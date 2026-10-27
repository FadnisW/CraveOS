# Operations

This document covers the release-safety contract for CraveOS: startup
configuration, database migrations, backups, restore drills, rollback and the
pre-deploy checklist.

The API is the only writer to PostgreSQL. Redis holds OTP codes and BullMQ
kitchen jobs; it is not a source of truth and is not backed up.

## 1. Startup contract

`apps/api/src/common/config/env.validation.ts` validates the environment before
Nest opens a port. The process exits non-zero with a list of every problem when:

| Setting | Requirement |
| --- | --- |
| `DATABASE_URL` | Required. Must be a `postgres://` or `postgresql://` URL. |
| `REDIS_URL` | Required. Must be a `redis://` or `rediss://` URL. No localhost fallback. |
| `JWT_SECRET` | Required. In production: at least 32 characters and not an example value. |
| `DEV_OTP_BYPASS` | Must not be `true` when `NODE_ENV=production`. |
| `NEXT_PUBLIC_APP_URL` | In production: at least one explicit HTTPS origin, comma-separated, no localhost. Used for REST and WebSocket CORS. |

The same rule applies to the WebSocket gateway: origins are evaluated per
handshake from the validated list, never from a localhost default.

`app.enableShutdownHooks()` is enabled, so `SIGTERM` closes the Prisma pool,
the BullMQ worker and Redis connections. A supervisor can restart the process
without leaving orphaned jobs or connections.

### Readiness probe

```
GET /api/v1/health
```

- `200` with `status: "ok"` when PostgreSQL and Redis both answer within 3s.
- `503` with `status: "degraded"` when either dependency is down.
- Public, no secrets, no connection strings. Failure details are logged
  server-side only.

Example:

```json
{
  "status": "ok",
  "checkedAt": "2026-10-27T10:00:00.000Z",
  "uptimeSeconds": 120,
  "checks": {
    "database": { "status": "up", "latencyMs": 4 },
    "redis": { "status": "up", "latencyMs": 1 }
  }
}
```

Point the uptime monitor at this endpoint. Do not use `/` or a static page as a
health signal; neither proves the database or Redis is reachable.

### Local verification

```bash
npm run check:no-fakes
npm run typecheck
npm run typecheck:api
npm run build
npm run build:api
npm run check:prod-guard
npm run check:api-health
```

`check:prod-guard` proves the production guard rejects an example secret, a
localhost origin and `DEV_OTP_BYPASS=true`. `check:api-health` starts the built
API on port 4177 and requires both dependency checks to report `up`.

## 2. Database migrations

`prisma/migrations/0_init` is the baseline. It was generated from the schema
with:

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```

### Existing database created with `prisma db push`

The development database already contained the baseline tables. It was marked
as migrated once, after verifying there was no drift:

```bash
# Must print "This is an empty migration."
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script

npx prisma migrate resolve --applied 0_init
npx prisma migrate status
```

Do this only once per existing database. A fresh database must run
`prisma migrate deploy` instead.

### Development workflow

1. Edit `prisma/schema.prisma`.
2. Run `npm run db:migrate` and name the migration for the change.
3. Review the generated SQL. Reject destructive statements that are not part of
   an expand/contract plan.
4. Run `npx prisma generate`.
5. Commit the schema **and** the migration directory together.
6. Run the verification commands above.

Never use `prisma db push` against a database that has real data. It can drop
columns without a migration record.

### Production workflow

```bash
npx prisma migrate status     # must show no pending surprises
npx prisma migrate deploy     # apply committed migrations only
```

`migrate deploy` never generates a migration and never resets data. It stops on
the first failed migration.

### Migration review checklist

- [ ] The migration is committed with the schema change.
- [ ] `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ...`
      is empty after applying it to a scratch database.
- [ ] Destructive changes (drop column/table, narrowing a type) use
      expand/contract: deploy the additive change first, backfill, switch reads,
      then remove the old field in a later release.
- [ ] New non-null columns have a default or a backfill step.
- [ ] Indexes on foreign keys and hot query paths are present.
- [ ] A backup exists before the deploy.

### Phase 2 money migrations

Two committed migrations carry the money engine:

| Migration | What it changes |
| --- | --- |
| `20261027130000_phase2_money_engine` | Adds `Promotion`, `PromotionRedemption`, `MembershipPlan`, `MembershipPurchase`, `Referral`; backfills every existing membership to `plan-trial` with an `endsAt`; drops `PricingRule`; copies non-smoke legacy rules into `Promotion`. |
| `20261027140000_phase2_launch_config` | Makes `users.phone` nullable; adds wallet ledger references and membership-purchase idempotency; inserts the launch plans and the `WELCOME100`, `EATCLUB100`, `CRAVE50` promotions. |

Both were applied to a fresh database and to a clone of the development
database before touching the shared development database. The clone check is:

```bash
createdb craveos_phase2_check
DATABASE_URL="postgresql://localhost/craveos_phase2_check" npx prisma migrate deploy
DATABASE_URL="postgresql://localhost/craveos_phase2_check" npx prisma migrate status
```

The backfill is one-way: existing memberships lose any trial/renewal distinction
and keep a single `endsAt`. Do not re-run the migration against a database where
`PricingRule` still has data without a backup.

## 3. Backups

PostgreSQL is the only durable store. Back up the whole database, not selected
tables.

### Daily logical backup

```bash
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="craveos-$(date +%Y%m%d-%H%M).dump" \
  "$DATABASE_URL"
```

- Store the dump off the database host (object storage or a separate machine).
- Encrypt at rest. The dump contains customer names, phone numbers, addresses
  and order history.
- Retain at least 14 daily dumps and 8 weekly dumps.
- Restrict access to the backup bucket to the operators who restore.
- Check the exit code. A failed `pg_dump` must alert, not be ignored.

### Verify a dump without restoring

```bash
pg_restore --list craveos-YYYYMMDD-HHMM.dump > /dev/null
```

### Redis

Redis holds OTP codes (10-minute TTL) and BullMQ kitchen jobs. Losing Redis
logs users out of an in-flight OTP and may drop a kitchen notification; the
order row and the KDS REST endpoint remain authoritative. Do not restore Redis
from a stale snapshot over a live instance.

## 4. Restore drill

Run this quarterly and before a major migration. Record the date, operator,
dump name, restore duration and row counts.

```bash
# 1. Create a scratch database. Never restore over production.
createdb craveos_restore_check

# 2. Restore.
pg_restore \
  --dbname="postgresql://localhost/craveos_restore_check" \
  --no-owner \
  --no-acl \
  craveos-YYYYMMDD-HHMM.dump

# 3. Confirm the migration ledger is intact.
DATABASE_URL="postgresql://localhost/craveos_restore_check" \
  npx prisma migrate status

# 4. Compare row counts with production.
psql "postgresql://localhost/craveos_restore_check" -c "
  SELECT 'users', count(*) FROM users
  UNION ALL SELECT 'orders', count(*) FROM orders
  UNION ALL SELECT 'order_items', count(*) FROM order_items
  UNION ALL SELECT 'payments', count(*) FROM payments;
"

# 5. Spot-check one recent order, its payment and its wallet ledger entries.
# 6. Drop the scratch database.
dropdb craveos_restore_check
```

A backup is not real until a restore has succeeded. Record the drill result.

## 5. Rollback

### Application rollback

Keep the previous build artifact (storefront and API) available. On a bad
release:

1. Stop routing traffic to the new API instance.
2. Start the previous API build with the same environment variables.
3. Revert the storefront deployment.
4. Check `/api/v1/health`.
5. Place one test order through quote, payment and kitchen fan-out.

### Database rollback

Migrations are forward-only in normal operation. `prisma migrate deploy` has no
automatic down migration.

- **Additive change:** roll back the application only. The new column/table can
  stay in place.
- **Destructive change:** restore the last verified dump. This loses every write
  after the dump, so it is a last resort and requires an incident decision.
- **Failed migration:** do not edit the migration file after it has run in an
  environment. Fix forward with a new migration. If the migration is stuck
  half-applied, restore the pre-deploy dump and investigate.

### Incident sequence

1. Declare the incident and name one operator.
2. Stop writes if data is being corrupted.
3. Capture logs, the failing migration name and the current health report.
4. Roll back the application, then decide on a database restore.
5. Verify health and one end-to-end order.
6. Write down the timeline and the follow-up migration or code fix.

## 6. Pre-deploy checklist

- [ ] CI is green: no-fakes, both typechecks, both builds, migrations, startup
      guard and readiness probe.
- [ ] A fresh backup exists and `pg_restore --list` succeeds.
- [ ] `npx prisma migrate status` is clean before `migrate deploy`.
- [ ] `NODE_ENV=production` and every startup requirement in section 1 is set.
- [ ] `DEV_OTP_BYPASS` is absent or `false`.
- [ ] `NEXT_PUBLIC_APP_URL` contains only real HTTPS origins.
- [ ] Razorpay is in live mode and the webhook secret is configured.
- [ ] `RESEND_FROM_EMAIL` uses a verified sending domain.
- [ ] `/api/v1/health` returns `200` with both checks `up`.
- [ ] One real low-value order completes: quote, payment, kitchen ticket,
      dispatch, delivery OTP.
- [ ] A membership purchase completes with wallet and with Razorpay test mode,
      and the member quote is cheaper than the guest quote.
- [ ] A referral code is applied at signup and both wallets are credited only
      after the referee's first delivered order.
- [ ] Every advertised coupon is an `APPROVED` `Promotion` inside its window.
- [ ] The previous build artifact is available for rollback.

## 7. Secret rotation

| Secret | Impact | Procedure |
| --- | --- | --- |
| `JWT_SECRET` | Every existing session becomes invalid. | Deploy the new secret during a low-traffic window; users sign in again with email OTP. |
| `DATABASE_URL` password | API and backup jobs lose access. | Rotate in PostgreSQL, update the secret store, restart the API, run the health probe. |
| `REDIS_URL` password | OTP and kitchen queues stop. | Rotate, update, restart API and worker, place a test order. |
| `RAZORPAY_KEY_SECRET` / webhook secret | Payment creation and webhook verification fail. | Rotate in the Razorpay dashboard, update, restart, run a test payment. |
| `RESEND_API_KEY` | Sign-in OTP and order email fail. | Rotate in Resend, update, restart, request one OTP. |

Never commit a real secret. `.env.example` contains placeholders only.

## 8. Monitoring and known gaps

What exists today:

- `/api/v1/health` checks PostgreSQL and Redis.
- The API logs startup failures with the exact configuration problem.
- The no-fakes scanner blocks fake customer surfaces in CI.

What is **not** configured in this repository and must be set up on the host
before launch:

- An external uptime monitor polling `/api/v1/health` every minute.
- A scheduled `pg_dump` job with off-host storage and failure alerts.
- Log aggregation and an alert on repeated 5xx responses.
- A real rider notification channel. Rider OTP requests return `503` outside
  the development bypass until that channel exists.
- Automated restore drills. The procedure above is manual and must be recorded.

## 9. Money operations

The API is the only writer of money. Storefront totals are display-only and are
replaced by the server quote before an order is placed.

### Quote contract

`POST /pricing/quote` requires a customer session and either an `addressId` or a
`hubId`. It accepts `items: [{ menuItemId, quantity }]`, an optional
`couponCode`, and an optional `useWalletBalancePaise`. The server resolves:

1. the active membership and its member prices;
2. the delivery and packaging fees (zero for an active member);
3. the approved promotion inside its window, minimum order and usage limits;
4. 5% GST on food and packaging and 18% GST on delivery;
5. the wallet contribution, capped at the stored balance and the payable amount.

The response is in paise with rupee mirrors for the storefront. Never accept a
client-supplied price. The order transaction calls the same quote again, so a
stale quote cannot change what is charged.

### Membership

- Plans: `plan-trial` (30 days, granted at signup), `plan-monthly` ₹99,
  `plan-quarterly` ₹249, `plan-annual` ₹899.
- Purchase endpoints: `GET /membership/plans`, `GET /membership/me`,
  `POST /membership/purchase`, `POST /membership/purchase/verify`.
- A wallet purchase debits `WalletTransaction` in the same transaction that
  activates the membership. A Razorpay purchase activates only after signature
  verification or a verified webhook.
- Buying a paid plan during the trial starts it immediately; the remaining trial
  days are forfeited. A renewal extends from the current paid expiry. There is no
  auto-renewal and no stored card.
- The membership expiry cron marks `ACTIVE`/`TRIAL` rows past `endsAt` as
  `EXPIRED`; the quote engine also checks `endsAt` on every request.

### Referrals

- Every customer gets a unique `REF-XXXXXXXXXX` code at signup.
- Attribution happens once, at OTP verification, and only when the referrer has
  at least one delivered order and is not blocked.
- The reward is ₹100 to the referrer and ₹50 to the referee, paid inside the
  delivery transaction for the referee's first delivered order.
- A referrer is rewarded for at most 20 referrals. Beyond the cap the referee
  still receives ₹50 and the referrer receives nothing.
- Cancelled or refunded-before-delivery orders never qualify.

### Promotions

- Only `APPROVED` rows inside `startsAt`/`endsAt` apply. `PENDING_APPROVAL`,
  `DRAFT`, `REJECTED` and `ARCHIVED` rows are ignored by the quote engine.
- Every successful use writes a `PromotionRedemption` with the user and order.
  Per-user and total usage limits are counted from that table inside the order
  transaction with a row lock.
- The admin UI can create an approved promotion and review brand proposals.
  Brand ops can only submit `PENDING_APPROVAL` proposals.
- Do not advertise a coupon in copy, banners or notifications unless the row is
  approved and in its window.

### Ledger reconciliation

Run this before a launch and after any refund incident:

```sql
-- Wallet balance must equal the ledger sum per user.
SELECT u.id, u."walletBalance",
       COALESCE(SUM(w."amountInPaise"), 0) AS ledger
FROM users u
LEFT JOIN wallet_transactions w ON w."userId" = u.id
GROUP BY u.id
HAVING u."walletBalance" <> COALESCE(SUM(w."amountInPaise"), 0);
```

A non-empty result is a release blocker. Membership purchases must have a
matching `Payment` or wallet debit, and every `REWARDED` referral must have two
`REFERRAL_REWARD` wallet rows.

### Money smoke test

`npm run check:money-smoke` drives the complete money path against a running
development API:

```
trial signup -> serviceability -> address -> member quote + coupon
-> wallet top-up -> invalid-coupon rejection -> wallet order -> idempotent retry
-> coupon reuse rejection -> membership purchase -> idempotent retry
-> member quote -> expiry enforcement -> referral attribution
-> kitchen accept/pack -> dispatch -> delivery OTP -> referral reward
-> replay protection -> ledger reconciliation
```

Requirements: the API on `http://localhost:4000` (override with
`SMOKE_BASE_URL`), `NODE_ENV=development` with `DEV_OTP_BYPASS=true`, the
`craveos-postgres` Docker container, seeded hubs/menu/plans/promotions, and the
`opsadmin@eatclub.in` operations admin. The script creates two throwaway
customers and tops up their wallets; it never mutates existing customers. It is
a manual pre-release check, not part of `npm run verify`, because it needs a
live API and database.

### Repairing pre-ledger wallet balances

Accounts created before the wallet ledger existed can have a balance with no
matching `WalletTransaction`. Never edit `walletBalance` directly. Record the
missing movement so the ledger explains the balance:

```sql
INSERT INTO wallet_transactions
  (id, "userId", "amountInPaise", reason, "referenceType", "referenceId", "createdAt")
SELECT
  'wt-legacy-backfill-' || u.id,
  u.id,
  u."walletBalance" - COALESCE(SUM(w."amountInPaise"), 0),
  'ADMIN_ADJUSTMENT',
  'LEGACY_LEDGER_BACKFILL',
  'pre-phase2-data',
  now()
FROM users u
LEFT JOIN wallet_transactions w ON w."userId" = u.id
GROUP BY u.id
HAVING u."walletBalance" <> COALESCE(SUM(w."amountInPaise"), 0)
   AND NOT EXISTS (
     SELECT 1 FROM wallet_transactions b
     WHERE b."referenceType" = 'LEGACY_LEDGER_BACKFILL' AND b."userId" = u.id
   );
```

Re-run the reconciliation query afterwards; it must return zero rows. The
development seed now writes an opening ledger row for a newly created demo
customer and no longer resets an existing demo wallet on re-seed, so a fresh
database does not need this repair.
