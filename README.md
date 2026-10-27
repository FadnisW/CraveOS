# CraveOS

Multi-brand cloud-kitchen commerce platform: a customer storefront plus
operator consoles for platform admins, hub managers, brand teams and riders.

The project is in an active truth-reset phase. Every customer-visible claim
must trace `UI -> API -> database row -> verification`. `docs/FEATURES.md` is
the single source of truth for what is actually built, and
`npm run check:no-fakes` fails the build when a mock, invented rating, fake ETA
or demo fallback is reintroduced.

## What is live

| Area | Status |
| --- | --- |
| Brand and menu catalogue from PostgreSQL | Live |
| Address book and hub serviceability (point-in-polygon) | Live |
| Multi-brand cart with per-hub conflict handling | Live |
| Server-side pricing quote (delivery, packaging, 5% GST) | Live |
| UPI / card via Razorpay, full wallet payment | Live (Razorpay test keys locally) |
| Email OTP sign-in via Resend | Live when `RESEND_API_KEY` is configured |
| Order fan-out to per-brand kitchen tickets | Live |
| Kitchen display, dispatch, rider handoff and delivery OTP | Live |
| Wallet balance and append-only wallet ledger | Live |
| Brand menu management, stock/86-ing, analytics and finance | Live |
| Support ticket desk for operators | Live |
| Platform admin: staff, hubs, brands, finance, promotions, audit | Live |

## Not built yet

These surfaces are deliberately hidden or absent. Do not add navigation to
them until the underlying flow exists:

- Paid membership purchase, renewal or cancellation (new users currently get a
  real 30-day trial membership row; there is no purchase flow).
- Referral attribution or rewards. `User.referralCode` exists but nothing
  consumes it.
- Customer-facing promotions or Deals. A generic promotion engine is planned;
  only admin approval of brand-proposed rules exists today.
- Reviews, ratings and rider scores. Ratings are not displayed anywhere.
- Customer self-service order cancellation (the API exists; no button).
- Customer support ticket form (the API exists; only the operator desk exists).
- Production rider sign-in. Rider OTP requests return `503` outside the
  explicit development bypass because there is no rider email channel yet.
- ONDC integration.
- Live rider GPS map. The order screen refreshes status from the server; it
  does not draw a map or invent coordinates.

## Architecture

```
Browser
  └── Next.js storefront (repo root, src/)        http://localhost:3000
        └── REST + WebSocket
              └── NestJS API (apps/api)           http://localhost:4000/api/v1
                    ├── PostgreSQL 16 via Prisma
                    └── Redis 7 (OTP store, caches)
```

- Storefront: Next.js 16 (App Router), React 19, Tailwind CSS 4.
- API: NestJS 10, Prisma 5.22, Socket.IO, BullMQ.
- Payments: Razorpay. Email: Resend. No SMS or WhatsApp provider.
- Local infrastructure: Docker Compose for PostgreSQL and Redis.

## Local setup

Prerequisites: Node.js 20+, npm 10+, Docker Desktop.

```bash
# 1. Start PostgreSQL and Redis
docker-compose up -d

# 2. Configure the API
copy .env.example .env
# Fill in DATABASE_URL, REDIS_URL, JWT_SECRET, RAZORPAY_* and RESEND_API_KEY.
# For local sign-in without email, set DEV_OTP_BYPASS=true.

# 3. Install and prepare the database
npm install
npx prisma generate
npm run db:migrate:deploy

# 4. Seed the DEVELOPMENT database (demo brands, menu, staff, riders)
npm run db:seed

# 5. Start the API
cd apps/api
npm install
npm run dev

# 6. Start the storefront (new terminal, repo root)
npm run dev
```

`npm run db:seed` refuses to run when `NODE_ENV=production` unless
`ALLOW_DEV_SEED=true` is set explicitly. It creates demo accounts and fixture
orders/riders and must never touch a production database.

If a database was created before the baseline migration with `prisma db push`,
mark the baseline as applied once:

```bash
npx prisma migrate resolve --applied 0_init
npx prisma migrate status
```

See `docs/OPERATIONS.md` for the drift check that must pass before doing this.

### Production bootstrap

Production gets exactly one seeded row: the first super-admin. Hubs, brands,
menus, riders and customers are created through the operator consoles.

```bash
# NODE_ENV=production, plus:
# SUPER_ADMIN_EMAIL, SUPER_ADMIN_PHONE, SUPER_ADMIN_NAME (optional)
npm run db:migrate:deploy
npm run db:seed:prod
```

The API refuses to start in production unless `DATABASE_URL`, `REDIS_URL`, a
strong `JWT_SECRET` and explicit HTTPS `NEXT_PUBLIC_APP_URL` origins are set,
and `DEV_OTP_BYPASS` is off. See `docs/OPERATIONS.md` section 1.

## Verification

```bash
npm run check:no-fakes     # feature registry + banned fake patterns
npm run typecheck          # storefront types
npm run typecheck:api      # NestJS API types
npm run build              # production storefront build
npm run build:api          # production API build
npm run check:prod-guard   # production startup guard rejects unsafe config
npm run check:api-health   # PostgreSQL + Redis readiness probe
```

`check:api-health` starts the built API on port 4177, so stop any process that
already uses that port. Both the guard and the health check require
`npm run build:api` first.

The no-fakes check runs first in CI. A feature that is not backed by the API
and database must be marked `API`, `HIDDEN`, `PLANNED` or `REMOVED` in
`docs/FEATURES.md` and must not be reachable from the UI.

## Operations

`docs/OPERATIONS.md` is the release runbook: startup contract, health probe,
migration policy, backups, restore drills, rollback, secret rotation and the
pre-deploy checklist.

## Launch gates

Before taking real money, `docs/FEATURES.md` requires:

1. Legal identity, FSSAI licence, GSTIN, registered address and grievance
   officer are real values, not `{{PLACEHOLDER}}` tokens.
2. Refund, cancellation, shipping and terms pages are reviewed and published.
3. Razorpay live keys and webhook secret are configured.
4. `DEV_OTP_BYPASS` is off and the production startup guard passes.
5. Resend has a verified sending domain in `RESEND_FROM_EMAIL`.
6. Rider sign-in has a real delivery channel.
7. Database backups and restore drills are in place.
8. Every deploy has a tested rollback path.
9. `/api/v1/health` returns `200` with PostgreSQL and Redis both `up`.

## Repository layout

```
src/                 Next.js storefront and operator consoles
apps/api/            NestJS API, WebSocket gateway and workers
prisma/              Schema, migrations, development seed, production bootstrap
scripts/             no-fakes guard, startup guard check, health check
docs/FEATURES.md     Feature registry and launch gates
docs/OPERATIONS.md   Startup, migrations, backups, restore and rollback runbook
prototype/           Static design reference (not shipped)
```

## License

MIT
