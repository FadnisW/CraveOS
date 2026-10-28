# CraveOS — Role-Based Operations Addendum: Full Implementation Plan

> **Source Documents:**
> - [CraveOS_Software_Design_Document (1).md](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/CraveOS_Software_Design_Document%20%281%29.md) (Original SDD, 970 lines)
> - [CraveOS_Role_Based_Operations_Addendum.md](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/CraveOS_Role_Based_Operations_Addendum.md) (Operations Addendum, 480 lines)

---

## 📊 Current State Assessment

### What Already Exists (Fully Implemented)

| Subsystem | Status | Key Files |
| :--- | :--- | :--- |
| **Prisma Schema (18 models, 6 enums)** | ✅ Complete for customer-facing flows | [schema.prisma](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/prisma/schema.prisma) |
| **Auth Module (Email OTP + JWT)** | ✅ Fully implemented | [auth.service.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/auth/auth.service.ts) |
| **Catalog & Serviceability** | ✅ Ray-casting geofence, 86'd toggle | [catalog.service.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/catalog/catalog.service.ts) |
| **Order Fan-Out & Wallet Locking** | ✅ `prisma.$transaction` + `SELECT FOR UPDATE` | [orders.service.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/orders/orders.service.ts) |
| **Pricing & Membership Cron** | ✅ 30% member discount, trial auto-expire | [pricing.service.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/pricing/pricing.service.ts) |
| **Razorpay Payments + Webhooks** | ✅ HMAC verification, idempotent capture | [payments.service.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/payments/payments.service.ts) |
| **Logistics (basic rider assignment)** | ✅ Auto-assign, GPS ingestion, stale cron | [logistics.service.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/logistics/logistics.service.ts) |
| **WebSocket Gateway** | ✅ Order rooms + KDS rooms | [websockets.gateway.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/websockets/websockets.gateway.ts) |
| **BullMQ Kitchen Worker** | ✅ `brand_order.created` → KDS emit | [kitchen-notification.worker.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/queue/kitchen-notification.worker.ts) |
| **Frontend Storefront (11 views)** | ✅ Home, Menu, Brand, Cart, Checkout, Orders, Profile, Search, Deals, Membership, + 2 admin stubs | [src/views/](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/src/views) |
| **Frontend Cart Engine** | ✅ Multi-brand, hub-conflict guard | [CartContext.tsx](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/src/context/CartContext.tsx) |

### What the Addendum Requires (Gap Analysis)

| Gap | Addendum Reference | Effort |
| :--- | :--- | :--- |
| **`Rider` model — no backing entity exists** | §3 (new model) | High |
| **`RiderEarning` model — no earning ledger** | §3 (new model) | Medium |
| **`Ticket` model — no ticketing system** | §3 (new model) | Medium |
| **`MenuItem` fields missing** — `dietType`, `spiceLevel`, `gstPct`, `variants`, `addOns`, `scheduledFrom/To` | §3 (updated model) | Medium |
| **`DeliveryTrip` missing** — `deliveryOtp`, `otpVerifiedAt`, `proofPhotoUrl`, `lastPingAt`, 9-state `TripStatus` | §3 (updated model) | Medium |
| **`AdminSubRole` enum** — flat `ADMIN` string → granular sub-roles | §3 (new enum) | Medium |
| **RBAC Guards** — flat string check → scoped sub-role + hub/brand guards | §2, §8 | High |
| **Rider Backend Module** — onboarding, KYC, approval, earnings, trip state machine | §6.1–6.10 | High |
| **Ticketing Backend Module** — CRUD, assignment, SLA tracking | §4.8 | Medium |
| **Admin Backend Endpoints** — dashboards, user mgmt, finance, promotions, CMS, analytics, RBAC | §4.1–4.11 | High |
| **Admin Frontend (11 screens)** — Dashboard, Users, Hubs/Brands, Riders, Orders, Finance, Promotions, Tickets, CMS, Analytics, RBAC | §4.1–4.11 | Very High |
| **Hub Manager Frontend (5 areas)** — Dashboard, Stock/86, Staffing, Finance, Rider Handoff | §5.1 | High |
| **Brand Ops Manager Frontend (5 areas)** — Dashboard, Menu CRUD, Pricing, Analytics, Finance | §5.2 | High |
| **Enhanced KDS** — prep timer, print ticket, audible alerts, reject-with-reason | §5.3 | Medium |
| **Delivery Partner Frontend (10 screens)** — Onboarding, Home, Trip Offer, Active Delivery, Navigation, OTP Verification, Earnings, Incentives, Support, Profile | §6.1–6.10 | Very High |
| **Real-Time Event Matrix** — cross-role WebSocket routing for 10 event types | §7 | Medium |

---

## 🏗️ Implementation Chunks (Sequential, Top-Down Execution)

> [!IMPORTANT]
> Execute these chunks **strictly in order**. Each chunk builds on the previous one. Within each chunk, tasks are also ordered by dependency.

---

### Chunk 1: Prisma Schema — New Enums

> **Goal:** Add all new enum types required by the addendum before any model references them.

#### [MODIFY] [schema.prisma](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/prisma/schema.prisma)

1. Add `AdminSubRole` enum: `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `FINANCE_ADMIN`, `SUPPORT_ADMIN`, `MARKETING_ADMIN`
2. Add `RiderStatus` enum: `PENDING_APPROVAL`, `APPROVED`, `SUSPENDED`, `REJECTED`
3. Add `TicketStatus` enum: `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
4. **Expand** existing `TripStatus` enum from `UNASSIGNED | ASSIGNED | PICKED_UP | DELIVERED` to the full 9-state machine: `UNASSIGNED`, `ASSIGNED`, `ACCEPTED`, `ARRIVED_AT_HUB`, `PICKED_UP`, `ARRIVING`, `DELIVERED`, `STALE`, `CANCELLED`

---

### Chunk 2: Prisma Schema — New Models (`Rider`, `RiderEarning`, `Ticket`)

> **Goal:** Add the three entirely new data models from Addendum §3.

#### [MODIFY] [schema.prisma](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/prisma/schema.prisma)

1. **Add `Rider` model:**
   - Fields: `id`, `phone` (unique), `name`, `status` (RiderStatus, default PENDING_APPROVAL), `vehicleType`, `vehicleRegNo?`, `licenceDocUrl?`, `vehicleRcDocUrl?`, `bankAccountRef?`, `upiId?`, `isOnline` (default false), `liveLat?`, `liveLng?`, `currentHubId?`, `capacityMax` (default 1), `rating?` (default 5.0), `createdAt`, `approvedAt?`
   - Relations: `trips` → `DeliveryTrip[]`, `earnings` → `RiderEarning[]`, `currentHub` → `Hub?`
   - Index: `@@index([status, isOnline])`

2. **Add `RiderEarning` model:**
   - Fields: `id`, `riderId`, `tripId?`, `type` (String: BASE_FEE / DISTANCE_FEE / SURGE / TIP / INCENTIVE / PENALTY / PAYOUT), `amountInPaise` (signed Int), `createdAt`
   - Relations: `rider` → `Rider`
   - Index: `@@index([riderId, createdAt])`

3. **Add `Ticket` model:**
   - Fields: `id`, `raisedByType` (String: CUSTOMER / HUB / BRAND_OPS / RIDER), `raisedById`, `orderId?`, `category` (String: MISSING_ITEM / WRONG_ITEM / LATE_DELIVERY / PAYMENT_ISSUE / RIDER_SAFETY / OTHER), `status` (TicketStatus, default OPEN), `assignedToId?`, `priority` (String, default NORMAL), `resolutionNote?`, `createdAt`, `resolvedAt?`
   - Index: `@@index([status, priority])`, `@@index([raisedById])`

---

### Chunk 3: Prisma Schema — Update Existing Models

> **Goal:** Enrich `MenuItem`, `DeliveryTrip`, `User`, and `Hub` per addendum §3.

#### [MODIFY] [schema.prisma](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/prisma/schema.prisma)

1. **Update `MenuItem`** — Add 8 new fields:
   - `dietType String?` (VEG / NON_VEG / EGG / JAIN)
   - `spiceLevel Int?` (0–3)
   - `gstPct Int?`
   - `variants Json?` (array of `{ name, priceInPaise }`)
   - `addOns Json?` (array of `{ name, priceInPaise }`)
   - `scheduledFrom String?` (HH:mm)
   - `scheduledTo String?` (HH:mm)

2. **Update `DeliveryTrip`** — Add 4 new fields + update relation:
   - `deliveryOtp String?` (generated on PICKED_UP)
   - `otpVerifiedAt DateTime?`
   - `proofPhotoUrl String?`
   - `lastPingAt DateTime?`
   - Add proper `rider Rider? @relation(fields: [riderId], references: [id])` relation

3. **Update `User`** — Add role field:
   - `role String @default("CUSTOMER")` (CUSTOMER / HUB_STAFF / HUB_MANAGER / BRAND_OPS / RIDER / ADMIN)
   - `adminSubRole AdminSubRole?` (only set when role = ADMIN)
   - `scopedHubId String?` (for HUB_STAFF / HUB_MANAGER)
   - `scopedBrandId String?` (for BRAND_OPS)

4. **Update `Hub`** — Add operating hours:
   - `operatingHoursStart String?` (HH:mm)
   - `operatingHoursEnd String?` (HH:mm)
   - `riders Rider[]` relation (1:N via `currentHubId`)

---

### Chunk 4: Database Migration & Seed Update

> **Goal:** Apply the schema changes to the database and update seed data.

#### Tasks:
1. Run `npx prisma migrate dev --name add-rider-ticket-enhanced-models`
2. **Update** [seed.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/prisma/seed.ts):
   - Add 5–8 seed `Rider` entries (mix of APPROVED, PENDING_APPROVAL, SUSPENDED)
   - Add sample `RiderEarning` records for approved riders
   - Add sample `Ticket` entries (OPEN, RESOLVED)
   - Update `MenuItem` seed data with `dietType`, `spiceLevel`, `gstPct`, `variants`, `addOns`
   - Add a `SUPER_ADMIN` user and an `OPERATIONS_ADMIN` user
   - Add sample Hub Manager and Brand Ops Manager users with scoped permissions
3. Run `npx prisma db seed`

---

### Chunk 5: Shared Types & DTO Updates

> **Goal:** Update the shared types package and frontend types to include new enums and interfaces.

#### [MODIFY] [packages/shared-types/src/index.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/packages/shared-types/src/index.ts)

1. Add `AdminSubRole` enum
2. Add `RiderStatus` enum
3. Add `TicketStatus` enum
4. Expand `TripStatus` to 9 states
5. Add `UserRole` enum: `CUSTOMER | HUB_STAFF | HUB_MANAGER | BRAND_OPS | RIDER | ADMIN`
6. Add Zod schemas: `CreateRiderSchema`, `UpdateRiderStatusSchema`, `CreateTicketSchema`, `UpdateTicketSchema`, `RiderLocationUpdateSchema`, `DeliveryOtpVerifySchema`

#### [MODIFY] [src/types.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/src/types.ts)

1. Add `Rider` interface
2. Add `RiderEarning` interface
3. Add `Ticket` interface
4. Add `AdminSubRole`, `RiderStatus`, `TicketStatus` type unions
5. Expand `TripStatus` type
6. Add `UserRole` type
7. Update `MenuItem` interface with `dietType`, `spiceLevel`, `gstPct`, `variants`, `addOns`, `scheduledFrom`, `scheduledTo`

---

### Chunk 6: Backend — RBAC Guard System

> **Goal:** Replace the flat string role check from SDD §8.2 with a proper NestJS guard system supporting sub-roles and scoped access (Addendum §2, §8).

#### [NEW] `apps/api/src/common/guards/roles.guard.ts`
- Custom `@Roles()` decorator accepting `UserRole[]`
- `RolesGuard` implementing `CanActivate`:
  - Extracts JWT payload from request
  - Validates `user.role` against required roles
  - For `ADMIN`, additionally checks `adminSubRole` against allowed sub-roles
  - For `HUB_STAFF` / `HUB_MANAGER`, validates `scopedHubId` matches request param `:hubId`
  - For `BRAND_OPS`, validates `scopedBrandId` matches request param `:brandId`

#### [NEW] `apps/api/src/common/decorators/roles.decorator.ts`
- `@Roles(...roles: string[])` metadata decorator
- `@AdminSubRoles(...subRoles: AdminSubRole[])` metadata decorator

#### [MODIFY] [app.module.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/app.module.ts)
- Register `RolesGuard` as a global guard via `APP_GUARD` provider

#### [MODIFY] [auth.service.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/auth/auth.service.ts)
- Include `role`, `adminSubRole`, `scopedHubId`, `scopedBrandId` in JWT payload

---

### Chunk 7: Backend — Rider Module (Onboarding, KYC, Status Management)

> **Goal:** Implement the full Rider subsystem from Addendum §6.1–6.2, §4.4.

#### [NEW] `apps/api/src/modules/riders/riders.module.ts`
#### [NEW] `apps/api/src/modules/riders/riders.controller.ts`

**Endpoints:**
| Method | Path | Guard | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/riders/register` | Public | Rider phone OTP registration |
| `POST` | `/riders/verify-otp` | Public | Verify rider phone OTP |
| `GET` | `/riders` | Admin (Ops/Super) | List all riders with filters (status, hub, online) |
| `GET` | `/riders/:id` | Admin / Self | Get rider detail (docs, vehicle, earnings, trips) |
| `PATCH` | `/riders/:id/status` | Admin (Ops/Super) | Approve / Reject / Suspend rider KYC |
| `PATCH` | `/riders/:id/documents` | Self (Rider) | Upload/update KYC documents |
| `PATCH` | `/riders/:id/bank` | Self (Rider) | Update bank/UPI details |
| `PATCH` | `/riders/:id/online` | Self (Rider) | Toggle online/offline status |
| `PATCH` | `/riders/:id/hub` | Self (Rider) | Set current staged hub |
| `GET` | `/riders/:id/earnings` | Self / Admin (Finance) | Get earnings ledger with date filters |
| `GET` | `/riders/approval-queue` | Admin (Ops/Super) | Pending KYC submissions |

#### [NEW] `apps/api/src/modules/riders/riders.service.ts`

**Business Logic:**
- `registerRider(phone)`: Generate OTP, store in Redis, send via Resend/SMS
- `verifyRiderOtp(phone, code)`: Create `Rider` with `PENDING_APPROVAL`, issue JWT with `role: 'RIDER'`
- `approveRider(id)`: Set status to `APPROVED`, set `approvedAt`
- `rejectRider(id, reason)`: Set status to `REJECTED`
- `suspendRider(id, reason)`: Set status to `SUSPENDED`
- `toggleOnline(id, isOnline)`: Update `isOnline`, clear coordinates if going offline
- `getApprovalQueue()`: Fetch riders where `status = PENDING_APPROVAL` ordered by `createdAt`
- `getRiderEarnings(id, dateRange)`: Aggregate `RiderEarning` records

---

### Chunk 8: Backend — Enhanced Delivery Trip State Machine & OTP Verification

> **Goal:** Implement the 9-state trip lifecycle from Addendum §6.3–6.6.

#### [MODIFY] [logistics.service.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/logistics/logistics.service.ts)

1. **Refactor `autoAssignRider`** to use `Rider` model instead of stub rider IDs:
   - Query `Rider` where `status = APPROVED`, `isOnline = true`, has fewer active trips than `capacityMax`
   - Prefer riders at the same `currentHubId` as the order's hub
   - Create trip with status `ASSIGNED`

2. **Add new methods for state transitions:**
   - `acceptTrip(tripId, riderId)`: ASSIGNED → ACCEPTED (rider confirms)
   - `arrivedAtHub(tripId, riderId, lat, lng)`: ACCEPTED → ARRIVED_AT_HUB (geofence-validated)
   - `confirmPickup(tripId, riderId)`: ARRIVED_AT_HUB → PICKED_UP, generate 4-digit `deliveryOtp`
   - `arrivedAtCustomer(tripId, riderId)`: PICKED_UP → ARRIVING (geofence-validated)
   - `verifyDeliveryOtp(tripId, riderId, otp, proofPhotoUrl?)`: ARRIVING → DELIVERED if OTP matches
   - `rejectTrip(tripId, riderId, reason)`: ASSIGNED → UNASSIGNED (re-queue for next rider)
   - `cancelTrip(tripId, reason)`: Any active state → CANCELLED

3. **Add earnings creation on delivery:**
   - On DELIVERED: Create `RiderEarning` records (BASE_FEE + DISTANCE_FEE)

4. **Update `updateRiderLocation`:**
   - Set `lastPingAt = now()` on every GPS ping
   - Update `Rider.liveLat` / `Rider.liveLng` as well as `DeliveryTrip.liveLat` / `liveLng`

#### [MODIFY] [logistics.controller.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/logistics/logistics.controller.ts)

Add new endpoints:
| Method | Path | Guard | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/logistics/trips/:id/accept` | Rider | Accept assigned trip |
| `POST` | `/logistics/trips/:id/arrived-hub` | Rider | Confirm arrival at hub |
| `POST` | `/logistics/trips/:id/pickup` | Rider | Confirm pickup, generate OTP |
| `POST` | `/logistics/trips/:id/arrived-customer` | Rider | Confirm arrival at customer |
| `POST` | `/logistics/trips/:id/deliver` | Rider | Verify OTP + complete delivery |
| `POST` | `/logistics/trips/:id/reject` | Rider | Reject trip offer |
| `GET` | `/logistics/trips/rider/:riderId/active` | Rider | Get rider's current active trip |
| `GET` | `/logistics/trips/rider/:riderId/history` | Rider / Admin | Get rider's trip history |

#### [MODIFY] Stale tracking cron
- Update to use `lastPingAt` field instead of `updatedAt`
- Set trip status to `STALE` (new enum value) instead of just logging

---

### Chunk 9: Backend — Ticketing & Support Module

> **Goal:** Implement the support/dispute system from Addendum §4.8.

#### [NEW] `apps/api/src/modules/tickets/tickets.module.ts`
#### [NEW] `apps/api/src/modules/tickets/tickets.controller.ts`

**Endpoints:**
| Method | Path | Guard | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/tickets` | Customer / Rider / HubStaff / BrandOps | Create a new ticket |
| `GET` | `/tickets` | Admin (Support/Ops/Super) | List all tickets with filters |
| `GET` | `/tickets/:id` | Admin / Raiser | Get ticket detail |
| `PATCH` | `/tickets/:id/assign` | Admin (Support/Ops/Super) | Assign ticket to staff |
| `PATCH` | `/tickets/:id/status` | Admin (Support/Ops/Super) | Update ticket status |
| `PATCH` | `/tickets/:id/resolve` | Admin (Support/Ops/Super) | Resolve with note |
| `GET` | `/tickets/user/:userId` | Self / Admin | Get user's tickets |
| `GET` | `/tickets/stats` | Admin | Ticket SLA metrics |

#### [NEW] `apps/api/src/modules/tickets/tickets.service.ts`

**Business Logic:**
- `createTicket(dto)`: Create ticket, emit WebSocket event to support queue
- `assignTicket(id, staffId)`: Set `assignedToId`, status → ASSIGNED
- `updateStatus(id, status)`: Validate state transitions
- `resolveTicket(id, note)`: Set `resolvedAt`, status → RESOLVED
- `getTicketStats()`: Aggregate open/resolved counts, average resolution time, SLA compliance

---

### Chunk 10: Backend — Admin Endpoints (Dashboard, User Mgmt, Finance, Analytics)

> **Goal:** Implement the extensive admin backend API from Addendum §4.1–4.11.

#### [NEW] `apps/api/src/modules/admin/admin.module.ts`
#### [NEW] `apps/api/src/modules/admin/admin.controller.ts`
#### [NEW] `apps/api/src/modules/admin/admin.service.ts`

**Endpoints — Dashboard (§4.1):**
| Method | Path | Guard |
| :--- | :--- | :--- |
| `GET` | `/admin/dashboard/kpis` | Admin (any) |
| `GET` | `/admin/dashboard/live-orders-map` | Admin (Ops/Super) |
| `GET` | `/admin/dashboard/order-distribution` | Admin (any) |
| `GET` | `/admin/dashboard/revenue-trend` | Admin (Finance/Super) |

**Endpoints — User Management (§4.2):**
| Method | Path | Guard |
| :--- | :--- | :--- |
| `GET` | `/admin/users` | Admin (Support/Ops/Super) |
| `GET` | `/admin/users/:id` | Admin (Support/Ops/Super) |
| `PATCH` | `/admin/users/:id/block` | Admin (Support/Super) |
| `POST` | `/admin/users/:id/wallet-adjust` | Admin (Support/Super) |
| `DELETE` | `/admin/users/:id` | Admin (Super) — DPDP deletion |

**Endpoints — Hub & Brand Management (§4.3):**
| Method | Path | Guard |
| :--- | :--- | :--- |
| `POST` | `/admin/hubs` | Admin (Ops/Super) |
| `PATCH` | `/admin/hubs/:id` | Admin (Ops/Super) |
| `POST` | `/admin/hubs/:id/assign-staff` | Admin (Ops/Super) |
| `POST` | `/admin/brands` | Admin (Super) |
| `PATCH` | `/admin/brands/:id` | Admin (Super) |
| `POST` | `/admin/brands/:id/assign-ops` | Admin (Super) |

**Endpoints — Finance (§4.6):**
| Method | Path | Guard |
| :--- | :--- | :--- |
| `GET` | `/admin/finance/transactions` | Admin (Finance/Super) |
| `GET` | `/admin/finance/rider-payouts` | Admin (Finance/Super) |
| `POST` | `/admin/finance/rider-payouts/batch` | Admin (Finance/Super) |
| `GET` | `/admin/finance/revenue-report` | Admin (Finance/Super) |
| `GET` | `/admin/finance/discount-report` | Admin (Finance/Super) |

**Endpoints — Promotions (§4.7):**
| Method | Path | Guard |
| :--- | :--- | :--- |
| `POST` | `/admin/promotions/pricing-rules` | Admin (Super) |
| `PATCH` | `/admin/promotions/pricing-rules/:id` | Admin (Super) |
| `POST` | `/admin/promotions/coupons` | Admin (Marketing/Super) |
| `GET` | `/admin/promotions/approval-queue` | Admin (Super) |
| `PATCH` | `/admin/promotions/approve/:id` | Admin (Super) |

**Endpoints — Analytics (§4.10):**
| Method | Path | Guard |
| :--- | :--- | :--- |
| `GET` | `/admin/analytics/sales` | Admin (Finance/Ops/Super) |
| `GET` | `/admin/analytics/customer-retention` | Admin (Ops/Super) |
| `GET` | `/admin/analytics/brand-performance` | Admin (Ops/Super) |
| `GET` | `/admin/analytics/hub-throughput` | Admin (Ops/Super) |
| `GET` | `/admin/analytics/delivery-performance` | Admin (Ops/Super) |
| `GET` | `/admin/analytics/cancellation-breakdown` | Admin (Ops/Super) |

**Endpoints — RBAC & Admin Staff (§4.11):**
| Method | Path | Guard |
| :--- | :--- | :--- |
| `GET` | `/admin/staff` | Admin (Super) |
| `POST` | `/admin/staff` | Admin (Super) |
| `PATCH` | `/admin/staff/:id` | Admin (Super) |
| `GET` | `/admin/audit-log` | Admin (Finance/Ops/Super) |

---

### Chunk 11: Backend — Hub Manager & Brand Ops Endpoints

> **Goal:** Implement hub-scoped and brand-scoped operational endpoints from Addendum §5.1–5.2.

#### [NEW] `apps/api/src/modules/hub-ops/hub-ops.module.ts`
#### [NEW] `apps/api/src/modules/hub-ops/hub-ops.controller.ts`
#### [NEW] `apps/api/src/modules/hub-ops/hub-ops.service.ts`

**Hub Manager Endpoints (§5.1):**
| Method | Path | Guard |
| :--- | :--- | :--- |
| `GET` | `/hub-ops/:hubId/dashboard` | HubManager / Admin |
| `GET` | `/hub-ops/:hubId/stock` | HubStaff / HubManager |
| `PATCH` | `/hub-ops/:hubId/stock/bulk-86` | HubStaff / HubManager |
| `GET` | `/hub-ops/:hubId/staff` | HubManager |
| `POST` | `/hub-ops/:hubId/staff/assign` | HubManager / Admin |
| `GET` | `/hub-ops/:hubId/finance` | HubManager / Admin (Finance) |
| `GET` | `/hub-ops/:hubId/riders` | HubManager |
| `POST` | `/hub-ops/:hubId/rider-handoff/:tripId` | HubStaff / HubManager |

#### [NEW] `apps/api/src/modules/brand-ops/brand-ops.module.ts`
#### [NEW] `apps/api/src/modules/brand-ops/brand-ops.controller.ts`
#### [NEW] `apps/api/src/modules/brand-ops/brand-ops.service.ts`

**Brand Ops Manager Endpoints (§5.2):**
| Method | Path | Guard |
| :--- | :--- | :--- |
| `GET` | `/brand-ops/:brandId/dashboard` | BrandOps / Admin |
| `GET` | `/brand-ops/:brandId/menu` | BrandOps / Admin |
| `POST` | `/brand-ops/:brandId/menu/items` | BrandOps |
| `PATCH` | `/brand-ops/:brandId/menu/items/:id` | BrandOps |
| `DELETE` | `/brand-ops/:brandId/menu/items/:id` | BrandOps |
| `PATCH` | `/brand-ops/:brandId/menu/items/bulk-price` | BrandOps |
| `POST` | `/brand-ops/:brandId/promotions/propose` | BrandOps |
| `GET` | `/brand-ops/:brandId/analytics` | BrandOps / Admin |
| `GET` | `/brand-ops/:brandId/finance` | BrandOps / Admin (Finance) |

---

### Chunk 12: Backend — Enhanced KDS & WebSocket Events

> **Goal:** Upgrade the KDS backend and implement the full real-time event matrix from Addendum §5.3, §7.

#### [MODIFY] [orders.service.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/orders/orders.service.ts)
- Add `rejectReason` to `updateBrandOrderStatus` when status = REJECTED
- Emit `brandOrderRejected` WebSocket event with partial refund details

#### [MODIFY] [websockets.gateway.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/apps/api/src/modules/websockets/websockets.gateway.ts)
- Add rooms: `admin:dashboard`, `admin:tickets`, `rider:${riderId}`
- Add events per the Real-Time Event Matrix (§7):
  - `tripOffered` → rider room
  - `tripAccepted` → customer room + admin dashboard
  - `riderArrivedAtHub` → hub KDS room
  - `riderPickedUp` → customer room (triggers live map) + hub KDS room (removes from queue)
  - `deliveryVerified` → customer room + admin dashboard
  - `ticketCreated` → admin tickets room
  - `brandOrderRejected` → customer room + brand ops room

---

### Chunk 13: Frontend — Update Types, Mock Data, API Client

> **Goal:** Prepare the frontend data layer for all new screens.

#### [MODIFY] [src/types.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/src/types.ts)
- Add all new interfaces and type unions from Chunk 5

#### [MODIFY] [src/data/mockData.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/src/data/mockData.ts)
- Add `MOCK_RIDERS: Rider[]` (5–8 entries)
- Add `MOCK_TICKETS: Ticket[]` (sample tickets)
- Update `MOCK_MENU_ITEMS` with `dietType`, `spiceLevel`, `variants`, `addOns`
- Add `MOCK_ADMIN_USERS` with different sub-roles

#### [MODIFY] [src/lib/api-client.ts](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/src/lib/api-client.ts)
- Add rider endpoints: `registerRider`, `verifyRiderOtp`, `getRiders`, `getRider`, `updateRiderStatus`, `toggleRiderOnline`, `getRiderEarnings`, `getApprovalQueue`
- Add trip state endpoints: `acceptTrip`, `arrivedAtHub`, `confirmPickup`, `arrivedAtCustomer`, `verifyDeliveryOtp`, `rejectTrip`, `getActiveRiderTrip`, `getRiderTripHistory`
- Add ticket endpoints: `createTicket`, `getTickets`, `getTicket`, `assignTicket`, `updateTicketStatus`, `resolveTicket`
- Add admin endpoints: `getAdminDashboard`, `getUsers`, `getUser`, `blockUser`, `adjustWallet`, `createHub`, `updateHub`, `createBrand`, `updateBrand`, `getTransactions`, `getRiderPayouts`, `batchRiderPayout`, `getRevenueReport`, `createPricingRule`, `createCoupon`, `getSalesAnalytics`, `getDeliveryPerformance`, `getAdminStaff`, `createAdminStaff`, `getAuditLog`
- Add hub-ops endpoints: `getHubDashboard`, `getHubStock`, `bulkToggle86`, `getHubStaff`, `assignHubStaff`, `getHubFinance`, `confirmRiderHandoff`
- Add brand-ops endpoints: `getBrandDashboard`, `getBrandMenu`, `createMenuItem`, `updateMenuItem`, `deleteMenuItem`, `bulkUpdatePrices`, `proposeBrandPromotion`, `getBrandAnalytics`, `getBrandFinance`

---

### Chunk 14: Frontend — Admin Dashboard & User Management Views

> **Goal:** Build the Platform Admin screens from Addendum §4.1–4.2.

#### [NEW] `src/views/admin/AdminDashboardView.tsx`
- KPI tiles (total orders, GMV, cancellations, failed payments)
- Active hubs / riders / brands count badges
- Pending rider KYC approvals badge with link
- Live order map placeholder (Google Maps embed or canvas)
- Order status distribution bar chart
- Revenue trend line chart (day/week/month toggle)
- Quick-action links to Orders, Tickets, Rider Queue

#### [NEW] `src/views/admin/AdminUserManagementView.tsx`
- Searchable/filterable customer table
- Customer detail slide-over (profile, addresses, order history, wallet ledger, membership, referrals)
- Block/unblock toggle
- Manual wallet credit/debit form with audit reason
- DPDP account deletion action

---

### Chunk 15: Frontend — Admin Hub, Brand & Rider Management Views

> **Goal:** Build Admin operational management screens from Addendum §4.3–4.4.

#### [NEW] `src/views/admin/AdminHubManagementView.tsx`
- Hub list with live order counts
- Create/edit hub form (name, address, lat/lng, polygon editor placeholder, operating hours)
- Assign brands to hub (toggle `BrandKitchen.isOpen`)
- Assign staff accounts to hub

#### [NEW] `src/views/admin/AdminBrandManagementView.tsx`
- Brand list with active hub counts
- Create/edit brand form (name, logo, cuisine tags, `isActive`)
- Assign Brand Ops Manager accounts
- Cross-hub brand performance summary
- Greyed-out `isOwned` / `commissionPct` fields (V1 forward-compatibility)

#### [NEW] `src/views/admin/AdminRiderManagementView.tsx`
- Rider approval queue (KYC review with document viewer)
- Rider list with filters (status, hub, online/offline)
- Rider detail page (docs, vehicle, trip history, earnings ledger, ratings)
- Approve / Reject / Suspend actions
- Live online riders map

---

### Chunk 16: Frontend — Admin Orders, Finance & Promotions Views

> **Goal:** Build Admin transaction and marketing screens from Addendum §4.5–4.7.

#### [NEW] `src/views/admin/AdminOrderManagementView.tsx`
- Full order table with multi-filter (status, hub, brand, date, payment)
- Order detail slide-over (Order → BrandOrder → OrderItem tree, payment, trip, discount breakdown)
- Order timeline / audit log viewer
- Actions: manually assign/reassign rider, issue full/partial refund

#### [NEW] `src/views/admin/AdminFinanceView.tsx`
- Transaction table (payments, refunds, failed, reconciliation)
- Rider payout console (pending amounts, mark-as-paid, batch export)
- Revenue reports by hub / brand / city
- Coupon/discount cost report

#### [NEW] `src/views/admin/AdminPromotionsView.tsx`
- `PricingRule` manager (create/edit Happy Hour, Meal-of-Day, BOGO windows)
- Coupon builder form (code, type, value, min order, brand scope, limits, expiry)
- Referral program config
- Brand-Ops promotion approval queue
- Campaign calendar view

---

### Chunk 17: Frontend — Admin Support, CMS, Analytics & RBAC Views

> **Goal:** Build remaining Admin screens from Addendum §4.8–4.11.

#### [NEW] `src/views/admin/AdminTicketsView.tsx`
- Ticket queue with filters (category, status, priority, raised-by)
- Ticket detail (linked order, resolution note, staff assignment dropdown)
- Bulk actions (assign, close, escalate)
- SLA timer display (time-to-first-response, time-to-resolution)

#### [NEW] `src/views/admin/AdminCMSView.tsx`
- Banner manager (image URL, link target, active date range, placement area)
- Homepage section drag-and-drop rail ordering
- Featured brand toggle
- Static page editor (FAQs, Terms, Privacy, About)

#### [NEW] `src/views/admin/AdminAnalyticsView.tsx`
- Sales analytics charts (GMV, AOV, volume trends)
- Customer retention / repeat rate
- Cross-brand performance leaderboard
- Hub throughput comparison
- Delivery performance (avg time, on-time %, STALE rate)
- Cancellation breakdown (by reason, hub, brand)
- Peak-hour heatmap

#### [NEW] `src/views/admin/AdminRBACView.tsx`
- Admin staff accounts list filtered by `AdminSubRole`
- Create/edit admin account form (name, email, sub-role, city/hub scope)
- Audit log viewer with filters (actor, action, date range)

---

### Chunk 18: Frontend — Hub Manager & Brand Ops Views

> **Goal:** Build Restaurant-side operational screens from Addendum §5.1–5.2.

#### [NEW] `src/views/hub-ops/HubDashboardView.tsx`
- Today's orders across all brands at this hub
- Live queue grouped by brand (New / Preparing / Ready / Awaiting Pickup)
- Hub revenue (today, this week)
- Staff on shift indicator
- Active riders staged at hub

#### [NEW] `src/views/hub-ops/HubStockView.tsx`
- Cross-brand item grid for this hub
- Toggle any item 86'd regardless of brand
- Bulk 86 capability (e.g., "mark all dairy items unavailable")

#### [NEW] `src/views/hub-ops/HubFinanceView.tsx`
- Revenue by brand within this hub
- Order volume trend
- Average prep time by brand

#### [NEW] `src/views/brand-ops/BrandDashboardView.tsx`
- Cross-hub performance for own brand (orders, revenue, AOV, cancellation rate)
- Best/worst performing items this week

#### [NEW] `src/views/brand-ops/BrandMenuManagementView.tsx`
- Category tree editor
- Item CRUD form (name, description, price, image upload, GST %, diet tag, bestseller, spice level)
- Variant editor (Small/Medium/Large pricing)
- Add-on editor (Extra cheese +₹50)
- Scheduled availability (`scheduledFrom` / `scheduledTo`)
- Bulk price update (all hubs or per-hub override)

#### [NEW] `src/views/brand-ops/BrandAnalyticsView.tsx`
- Sales by hub
- Item-level performance (best/worst sellers)
- Brand-specific cancellation rate

---

### Chunk 19: Frontend — Enhanced KDS View

> **Goal:** Upgrade the existing KDS to match Addendum §5.3.

#### [MODIFY] [src/views/AdminKDSView.tsx](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/src/views/AdminKDSView.tsx)

1. Add **audible new-order alert** (Web Audio API beep on new `kdsTicketUpdated` event)
2. Add **Reject with reason** flow — modal requiring reason selection before rejecting a BrandOrder
3. Add **Prep-time countdown timer** per ticket (configurable per brand, starts on ACCEPT)
4. Add **"Mark Ready"** button that triggers rider-assignment gate check
5. Add **Print kitchen ticket** button (generates printable receipt format)
6. Add **Customer name + item-level notes** display on each ticket card
7. Restructure layout to **Kanban columns** (New → Preparing → Ready) per Addendum §5.3

---

### Chunk 20: Frontend — Delivery Partner App (Mobile-First, 10 Screens)

> **Goal:** Build the complete Delivery Partner experience from Addendum §6.1–6.10.

#### [NEW] `src/views/rider/RiderOnboardingView.tsx` (§6.1)
- Phone verification (OTP input)
- Personal details form (name, photo, emergency contact)
- Vehicle details (type selector, registration number)
- Document upload (licence, RC, Aadhaar/KYC) with upload progress
- Bank/UPI details form
- "Application Submitted" under-review status card

#### [NEW] `src/views/rider/RiderHomeView.tsx` (§6.2)
- Large Online/Offline toggle
- Today's earnings (live-updating)
- Today's delivery count
- Current rating (stars)
- Weekly earnings mini-chart
- "Near a hub" repositioning nudge
- Incentive progress bar
- Bottom nav (Home / Earnings / Support / Profile)

#### [NEW] `src/views/rider/RiderTripOfferView.tsx` (§6.3)
- Modal overlay when trip is offered
- Hub name, pickup address, brand packet count
- Distance to hub + distance to customer
- Estimated total time and estimated earnings
- Countdown timer (auto-decline)
- Accept / Reject buttons with reject reason quick-picks

#### [NEW] `src/views/rider/RiderActiveDeliveryView.tsx` (§6.4)
- State-machine driven UI switching between:
  - **En route to hub:** Map + geofenced "Arrived at Hub" button
  - **At hub:** Packet checklist + "Confirm Pickup" button
  - **En route to customer:** Map + live ETA + Call/Message buttons
  - **At customer:** → hands off to verification
- Persistent order detail drawer
- Cancel/report issue action

#### [NEW] `src/views/rider/RiderDeliveryVerificationView.tsx` (§6.6)
- OTP entry field (4-digit numeric)
- OTP mismatch error state with retry
- Optional photo proof capture (camera API)
- "Confirm Delivery" button (enabled only after OTP match)
- Earnings-for-this-trip summary on success

#### [NEW] `src/views/rider/RiderEarningsView.tsx` (§6.7)
- Filter tabs (Today / This Week / This Month / Custom)
- Trip-by-trip breakdown (base, distance, surge, tip, incentive, penalty)
- Running total
- Payout history list
- Next payout indicator
- Download statement button (PDF/CSV)

#### [NEW] `src/views/rider/RiderSupportView.tsx` (§6.9)
- Quick-action tiles (Restaurant Issue, Customer Issue, Payment, Order)
- Emergency/Accident button (prominent, creates URGENT ticket)
- Ticket history with status
- Call/Chat support entry points

#### [NEW] `src/views/rider/RiderProfileView.tsx` (§6.10)
- Personal info (editable photo, emergency contact)
- Vehicle info (editable, triggers re-verification)
- Documents viewer & re-upload
- Bank/UPI details
- Rating breakdown & customer feedback
- Delivery history
- Performance stats (acceptance rate, on-time rate, total deliveries)
- Logout / Deactivate

---

### Chunk 21: Frontend — Navigation & Routing Integration

> **Goal:** Wire all new views into the app shell and role-based navigation.

#### [MODIFY] [src/App.tsx](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/src/App.tsx)

1. Add role-based view routing:
   - If `user.role === 'ADMIN'` → show Admin sidebar navigation with all §4 screens
   - If `user.role === 'HUB_MANAGER'` or `'HUB_STAFF'` → show Hub Ops navigation
   - If `user.role === 'BRAND_OPS'` → show Brand Ops navigation
   - If `user.role === 'RIDER'` → show Rider app shell
   - Default (`CUSTOMER`) → existing storefront

2. Update `currentView` state to include all new view identifiers

3. Add role-aware **top navigation switcher** extending the existing Admin Console Mode bar to include:
   - Customer App / Kitchen KDS / Rider Dispatch / **Admin Console** / **Hub Ops** / **Brand Ops** / **Rider App**

#### [MODIFY] [src/components/Navbar.tsx](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/src/components/Navbar.tsx)
- Show/hide navigation items based on user role

#### [MODIFY] [src/components/MobileBottomNav.tsx](file:///c:/Users/darks/New%20Drive/Web%20Application%20Projects/Eatclub/src/components/MobileBottomNav.tsx)
- Rider-specific bottom nav (Home / Earnings / Support / Profile)

---

### Chunk 22: Seed Data, Migration Verification & Smoke Testing

> **Goal:** Ensure the complete system works end-to-end.

#### Tasks:
1. Run final `npx prisma migrate dev` to verify all schema changes are clean
2. Run `npx prisma db seed` with updated comprehensive seed data
3. Verify all backend modules start without errors: `npm run dev` in `apps/api/`
4. Verify frontend builds cleanly: `npm run build` from root
5. Smoke test critical flows:
   - Customer: browse → cart → checkout → order tracking
   - Admin: dashboard → user management → rider approval → order management
   - Hub Manager: KDS → 86 items → rider handoff
   - Brand Ops: menu CRUD → propose promotion
   - Rider: onboarding → go online → accept trip → pickup → OTP deliver

---

### Chunk 23: Git Commit & Push

> **Goal:** Commit all addendum implementation changes to GitHub.

#### Tasks:
1. `git add .`
2. `git commit -m "feat: implement Role-Based Operations Addendum — Rider, Ticketing, Admin, Hub/Brand Ops, and Delivery Partner systems"`
3. `git push origin main`

---

## 📋 Execution Summary

| Chunk | Category | Effort | Dependencies |
| :--- | :--- | :--- | :--- |
| **1** | Schema — New Enums | 🟢 Small | None |
| **2** | Schema — New Models | 🟡 Medium | Chunk 1 |
| **3** | Schema — Update Existing Models | 🟡 Medium | Chunk 2 |
| **4** | Migration & Seed | 🟢 Small | Chunk 3 |
| **5** | Shared Types & DTOs | 🟡 Medium | Chunk 4 |
| **6** | Backend — RBAC Guards | 🔴 High | Chunk 5 |
| **7** | Backend — Rider Module | 🔴 High | Chunk 6 |
| **8** | Backend — Trip State Machine & OTP | 🔴 High | Chunk 7 |
| **9** | Backend — Ticketing Module | 🟡 Medium | Chunk 6 |
| **10** | Backend — Admin Endpoints | 🔴 High | Chunk 6 |
| **11** | Backend — Hub/Brand Ops Endpoints | 🟡 Medium | Chunk 6 |
| **12** | Backend — KDS & WebSocket Events | 🟡 Medium | Chunk 8 |
| **13** | Frontend — Types, Mocks, API Client | 🟡 Medium | Chunk 12 |
| **14** | Frontend — Admin Dashboard & Users | 🟡 Medium | Chunk 13 |
| **15** | Frontend — Admin Hub/Brand/Rider Mgmt | 🟡 Medium | Chunk 14 |
| **16** | Frontend — Admin Orders/Finance/Promos | 🟡 Medium | Chunk 15 |
| **17** | Frontend — Admin Support/CMS/Analytics/RBAC | 🟡 Medium | Chunk 16 |
| **18** | Frontend — Hub Ops & Brand Ops Views | 🟡 Medium | Chunk 13 |
| **19** | Frontend — Enhanced KDS | 🟡 Medium | Chunk 12 |
| **20** | Frontend — Delivery Partner App (10 screens) | 🔴 High | Chunk 13 |
| **21** | Frontend — Navigation & Routing | 🟡 Medium | Chunks 14–20 |
| **22** | Seed, Migration & Smoke Testing | 🟡 Medium | Chunk 21 |
| **23** | Git Commit & Push | 🟢 Small | Chunk 22 |

> [!TIP]
> Chunks 9–11 (Ticketing, Admin, Hub/Brand Ops backend) can be worked on **in parallel** after Chunk 6 (RBAC Guards) is complete, since they only depend on the guard system, not on each other.
> Similarly, frontend Chunks 14–20 can be parallelized after Chunk 13 (Types/Mocks/API Client).

---

## ⚠️ Open Design Decisions (from Addendum §9)

> [!IMPORTANT]
> These decisions should be resolved before starting the relevant chunks:

1. **Rider Multi-Drop Cap (affects Chunk 8):** What is the `capacityMax` value? How does the Trip Offer screen handle a second offer mid-trip?
2. **COD Scope (affects Chunk 10, 16):** Remove `COD` from V1 payment methods, or add cash reconciliation screens?
3. **Ticket WebSocket Channel (affects Chunk 12):** Same WebSocket gateway for tickets + orders, or a separate one?
4. **Third-Party Brand Toggle (affects Chunk 15):** Keep `isOwned` / `commissionPct` greyed-out in V1 UI, or hide entirely?
