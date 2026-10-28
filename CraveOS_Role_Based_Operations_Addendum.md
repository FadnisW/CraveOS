# 🧭 CraveOS — Role-Based Operations Addendum

### Admin, Restaurant (Hub Manager / Brand Ops Manager) & Delivery Partner: Screens, UI Features & Permissions

*(Companion document to the CraveOS Software Design Document. This addendum fleshes out the three operational roles — Platform Admin, Restaurant-side staff, and Delivery Partner — into concrete screens, on-screen features, new data models, and an updated permissions matrix, so they can be built directly against the existing NestJS/Next.js/Prisma architecture.)*

---

## 0. Purpose & Scope

The base SDD specifies the customer-facing storefront and ordering engine in depth, but leaves Admin, Hub/Brand Ops, and Delivery Partner as a permissions matrix (§2.4) with no screen-level detail. This document:

1. Reconciles a modeling conflict between CraveOS's **owned-brand** architecture and a generic **marketplace** feature list, and states which one this build follows.
2. Adds the data models needed to support staff/rider operations that the base schema doesn't yet cover (`Rider`, `Ticket`, `RiderEarning`, an expanded `MenuItem`, OTP fields on `DeliveryTrip`).
3. Specifies every screen for Platform Admin, Hub Manager, Brand Ops Manager, and Delivery Partner, with the concrete UI elements and data each screen needs.
4. Gives a full, updated role-permission matrix including Admin sub-roles.

---

## 1. Architectural Note: Owned-Brand vs. Marketplace — Which Model This Follows

CraveOS is an **owned-brand cloud-kitchen platform**, not a Swiggy/Zomato-style marketplace. This matters because it changes what "Restaurant Side" means:

| | Marketplace model (generic food-delivery brainstorm) | CraveOS owned-brand model (this build) |
|---|---|---|
| Who runs a "restaurant" | Independent third-party owners | CraveOS itself — brands are internal P&Ls |
| Onboarding | Self-serve signup, KYC, approval queue | Brands are created by Platform Admin; no external approval flow |
| Commission | Negotiated %, configurable per restaurant | N/A in V1 — no commission, since there's no external party to pay |
| Bank details / settlement | Restaurant's own bank account, payout ledger | Not needed — revenue stays internal; only **rider** payouts are external money movement |
| Suspend / disable | Punitive action against a third party | Operational toggle (e.g., "MOJO Pizza closed for renovation at Hub 3") |
| Staff | Owner creates Manager/Cashier/Kitchen accounts | Maps to CraveOS's existing **Hub Manager** and **Brand Ops Manager** roles |

**Decision for this document:** build Hub Manager and Brand Ops Manager as internal operational roles, not a restaurant-onboarding/marketplace system. The schema is kept forward-compatible with §4.4 of the base SDD (`Brand.isOwned: Boolean`, `Brand.commissionPct: Int?`), so a future third-party brand can be onboarded later without a rewrite — but no onboarding/approval/commission UI is built for V1.

---

## 2. Updated Role Hierarchy

```
PLATFORM ADMIN (Super Admin)
│
├── Operations Admin        — hubs, dispatch, day-to-day ops
├── Finance Admin           — payments, rider payouts, reconciliation
├── Support Admin           — tickets, refunds (bounded)
├── Marketing Admin         — promotions, CMS, campaigns
│
├── HUB MANAGER              — one physical location, all brands cooking there
├── HUB STAFF (KDS operator)  — reports to Hub Manager, per-hub
│
├── BRAND OPS MANAGER         — one brand, across all hubs
│
├── DELIVERY PARTNER (Rider)
│
└── CUSTOMER / SUPPORT AGENT  (unchanged from base SDD)
```

This replaces the flat `["HUB_STAFF", "BRAND_OPS", "ADMIN"]` role check in §8.2 of the base SDD with a proper sub-role enum for Admin, and formally introduces `RIDER` as a first-class authenticated role (the base SDD references `riderId` on `DeliveryTrip` but never defines a `Rider` model).

---

## 3. New & Updated Data Models

These extend `apps/api/prisma/schema.prisma` from the base SDD. Existing models are only shown where changed.

```prisma
// ── NEW: Rider (the base SDD referenced DeliveryTrip.riderId with no backing model)
model Rider {
  id               String       @id @default(cuid())
  phone            String       @unique
  name             String
  status           RiderStatus  @default(PENDING_APPROVAL) // PENDING_APPROVAL | APPROVED | SUSPENDED | REJECTED
  vehicleType      String       // "BIKE" | "SCOOTER" | "BICYCLE"
  vehicleRegNo     String?
  licenceDocUrl    String?
  vehicleRcDocUrl  String?
  bankAccountRef   String?      // tokenized, never raw account number
  upiId            String?
  isOnline         Boolean      @default(false)
  liveLat          Float?
  liveLng          Float?
  currentHubId     String?      // hub they're currently staged at / assigned to
  capacityMax      Int          @default(1) // concurrent multi-drop cap
  rating           Float?       @default(5.0)
  trips            DeliveryTrip[]
  earnings         RiderEarning[]
  createdAt        DateTime     @default(now())
  approvedAt       DateTime?
}

// ── UPDATED: DeliveryTrip — adds OTP verification + richer state
model DeliveryTrip {
  id            String     @id @default(cuid())
  orderId       String     @unique
  riderId       String?
  rider         Rider?     @relation(fields: [riderId], references: [id])
  status        TripStatus @default(UNASSIGNED)
  // UNASSIGNED | ASSIGNED | ACCEPTED | ARRIVED_AT_HUB | PICKED_UP | ARRIVING | DELIVERED | STALE | CANCELLED
  pickupLat     Float
  pickupLng     Float
  liveLat       Float?
  liveLng       Float?
  deliveryOtp   String?    // generated on PICKED_UP, shown to customer, entered by rider
  otpVerifiedAt DateTime?
  proofPhotoUrl String?    // optional delivery photo proof
  lastPingAt    DateTime?  // used to flag STALE if pings stop
}

// ── NEW: RiderEarning — append-only ledger, mirrors WalletTransaction's audit pattern
model RiderEarning {
  id             String   @id @default(cuid())
  riderId        String
  rider          Rider    @relation(fields: [riderId], references: [id])
  tripId         String?
  type           String   // "BASE_FEE" | "DISTANCE_FEE" | "SURGE" | "TIP" | "INCENTIVE" | "PENALTY" | "PAYOUT"
  amountInPaise  Int      // signed
  createdAt      DateTime @default(now())
}

// ── NEW: Ticket — support/dispute system, referenced in permissions matrix but never modeled
model Ticket {
  id            String       @id @default(cuid())
  raisedByType  String       // "CUSTOMER" | "HUB" | "BRAND_OPS" | "RIDER"
  raisedById    String
  orderId       String?
  category      String       // "MISSING_ITEM" | "WRONG_ITEM" | "LATE_DELIVERY" | "PAYMENT_ISSUE" | "RIDER_SAFETY" | "OTHER"
  status        TicketStatus @default(OPEN) // OPEN | ASSIGNED | IN_PROGRESS | RESOLVED | CLOSED
  assignedToId  String?      // Support Agent / Admin staff ID
  priority      String       @default("NORMAL") // "LOW" | "NORMAL" | "HIGH" | "URGENT"
  resolutionNote String?
  createdAt     DateTime     @default(now())
  resolvedAt    DateTime?
}

// ── UPDATED: MenuItem — was too thin to support the Brand Ops menu screens below
model MenuItem {
  id             String   @id @default(cuid())
  brandKitchenId String
  name           String
  description    String?
  priceInPaise   Int
  isAvailable    Boolean  @default(true) // hub-level 86'd flag
  category       String
  imageUrl       String?
  dietType       String?  // "VEG" | "NON_VEG" | "EGG" | "JAIN"
  isBestseller   Boolean  @default(false)
  spiceLevel     Int?     // 0–3
  gstPct         Int?
  variants       Json?    // [{ name: "Small", priceInPaise: 19900 }, ...]
  addOns         Json?    // [{ name: "Extra cheese", priceInPaise: 5000 }, ...]
  scheduledFrom  String?  // "HH:mm" — for items only sold at certain times
  scheduledTo    String?
}

// ── NEW: AdminStaff sub-role enum, replaces the flat string check in base SDD §8.2
enum AdminSubRole {
  SUPER_ADMIN
  OPERATIONS_ADMIN
  FINANCE_ADMIN
  SUPPORT_ADMIN
  MARKETING_ADMIN
}
```

---

## 4. Platform Admin — Screens & Features

### 4.1 Dashboard (landing screen)
- KPI tiles: total orders, today's orders, GMV, cancelled/refunded count, failed payments count
- Active hubs count, active riders online count, active brands count
- Pending approvals badge (rider KYC queue)
- Live order map (all in-flight `DeliveryTrip`s, color-coded by `TripStatus`)
- Order status distribution chart (Placed/Preparing/Out for Delivery/Delivered, live)
- Revenue trend chart (day/week/month toggle)
- New customer signups counter
- Quick links into Order Management, Ticket queue, Rider approval queue

### 4.2 Customer / User Management
- Searchable/filterable customer table (name, phone, email, signup date, order count, membership status)
- Customer detail page: profile, address book, order history, wallet ledger (`WalletTransaction` list), membership status, referral tree
- Block / unblock toggle
- Manual wallet credit/debit with reason (writes `WalletTransaction` + `AuditLog`)
- Linked tickets for that customer
- Account-deletion trigger (DPDP compliance, per base SDD §2.3)

### 4.3 Hub & Brand Management (this replaces "Restaurant Management" under the owned-brand model)
**Hub sub-screen:**
- Hub list (name, city, status, live order count, staff count)
- Create/edit hub: name, address, lat/lng, `servicePolygon` editor (map-based polygon draw), operating hours
- Assign brands to hub (`BrandKitchen` create/toggle `isOpen`)
- Assign Hub Manager / Hub Staff accounts to this hub
- Hub-level financial report (mirrors what Hub Manager sees, read-only for Admin)

**Brand sub-screen:**
- Brand list (name, slug, cuisine tags, active hub count, status)
- Create/edit brand: name, logo, cuisine tags, `isActive` toggle
- Assign Brand Ops Manager account(s) to a brand
- Brand-wide performance summary (cross-hub)
- (Future, disabled in V1 UI) `isOwned` / `commissionPct` fields for third-party brand onboarding — visible but greyed out, per §1

### 4.4 Delivery Partner Management
- Rider approval queue: pending KYC submissions, document viewer (licence, RC, bank/UPI), Approve / Reject with reason
- Rider list: name, status, online/offline, current hub, rating, active trip (if any)
- Rider detail page: documents, vehicle info, delivery history, `RiderEarning` ledger, incentive/penalty log, ratings/complaints, suspend/reactivate toggle
- Live map of online riders (feeds the Dashboard's live map)

### 4.5 Order Management
- Full order table: filterable by status, hub, brand, date range, payment status
- Order detail page: full `Order` → `BrandOrder` → `OrderItem` breakdown, `Payment` status, `DeliveryTrip` status, discount breakdown
- Order timeline / audit log view (from `AuditLog`)
- Actions: manually reassign rider, manually assign rider, contact customer / hub / rider (opens ticket or triggers notification), issue full or partial refund
- Filters for: cancelled, failed, rejected, delayed (SLA-breached), refunded

### 4.6 Payments & Finance
- Transaction table: customer payments, refunds, failed transactions, reconciliation status
- COD tracking (if/when COD is enabled — currently out of scope per base SDD payment methods)
- Rider payout console: pending payouts (sum of unpaid `RiderEarning` rows per rider), mark-as-paid, payout batch export
- Tax/GST report generation
- Coupon/discount cost report (total discount value given, by type)
- Revenue reports by hub, by brand, by city

### 4.7 Promotions
- `PricingRule` manager: create/edit Happy Hour, Meal-of-Day, BOGO windows (brand-scoped or platform-wide)
- Coupon builder: code, discount type (flat/%), min order value, brand scope, first-order-only, usage limit, per-user limit, expiry
- Referral program config: bonus amount, max wallet-redemption %
- Approval queue for Brand-Ops-proposed promotions (per base SDD matrix, Brand Ops can only propose "own brand" offers — Admin approves)
- Scheduled campaign calendar view

### 4.8 Support & Disputes (Ticketing)
- Ticket queue, filterable by category/status/priority/raised-by-type
- Ticket detail: linked order, conversation thread, resolution note, assign-to-staff dropdown
- Bulk actions: assign, close, escalate
- SLA timer per ticket (time-to-first-response, time-to-resolution)

### 4.9 Content / CMS
- Banner manager (image, link target, active date range, placement)
- Homepage section ordering (drag-and-drop rail order: Deal rails, Brand grid, Featured)
- Featured-brand toggle
- Notification template editor (Resend HTML email templates: order confirmation, membership renewal, referral bonus)
- Static page editor: FAQs, Terms, Privacy Policy, About Us

### 4.10 Analytics
- Sales analytics: GMV trend, AOV trend, order volume trend
- Customer retention / repeat-order rate
- Brand performance comparison (cross-brand leaderboard)
- Hub throughput comparison
- Delivery performance: average delivery time, on-time %, STALE-trip rate
- Cancellation-rate breakdown (by reason, by hub, by brand)
- Coupon usage / cost report
- Revenue-by-city map view
- Peak-hour heatmap

### 4.11 Admin Security & RBAC
- Admin staff account list, filtered by `AdminSubRole`
- Create/edit admin account, assign sub-role and scope (e.g., Operations Admin scoped to specific cities)
- Permission matrix editor (which sub-role can do what — see §8 below)
- Audit log viewer (all `AuditLog` entries, filterable by actor/action/date)
- Login history per admin account (IP, device, timestamp)
- 2FA enrollment status and enforcement toggle

---

## 5. Restaurant Side

### 5.1 Hub Manager — Screens & Features

**Hub Dashboard**
- Today's order count across all brands cooking at this hub
- Live queue: New / Preparing / Ready / Awaiting Pickup, grouped by brand
- Hub-level revenue (today, this week)
- Staff on shift indicator
- Active rider(s) currently at the hub

**Kitchen Display System (KDS)** — shared with Brand Ops view, see §5.3

**Stock / Availability**
- Cross-brand item grid for this hub only — toggle any item "86'd" (`MenuItem.isAvailable`) regardless of which brand it belongs to, since Hub Staff/Manager act at the physical-location level
- Bulk 86 (e.g., "mark all dairy items unavailable")

**Staffing**
- Assign/remove Hub Staff accounts for this hub
- Shift schedule (basic — who's on KDS duty when)

**Hub Financial Report**
- Revenue by brand, within this hub
- Order volume trend for this hub
- Average prep time by brand (feeds the delivery ETA calculation per base SDD §7.5)

**Rider Handoff**
- Current riders staged at hub, their assigned orders, pickup confirmation button (marks all brand packets for an order as handed off)

### 5.2 Brand Ops Manager — Screens & Features

**Brand Dashboard**
- Cross-hub view: today's orders, revenue, AOV, cancellation rate — for this brand only, across every hub it's active in
- Best-selling / worst-performing items this week

**Menu Management** (the most robust screen for this role)
- Category tree editor
- Item CRUD: name, description, price, image upload (Cloudinary), GST %, veg/non-veg/egg/Jain tag, bestseller flag, spice-level indicator
- Variant editor (e.g., Small/Medium/Large pricing)
- Add-on editor (e.g., Extra cheese +₹50)
- Combo builder
- Scheduled availability (e.g., breakfast-only items with `scheduledFrom`/`scheduledTo`)
- Bulk price update across all hubs at once, or per-hub override

**Brand-Wide Pricing**
- Base pricing per item (propagates to every `BrandKitchen` for this brand)
- Propose Happy Hour / Meal-of-Day window for this brand (submits to Admin's approval queue per §4.7)

**Brand Analytics**
- Sales by hub (which hub sells the most of this brand)
- Item-level performance (best/worst sellers)
- Rating/review summary for this brand
- Cancellation rate specific to this brand's `BrandOrder`s

**Brand Financial View**
- Revenue and order-volume report scoped to this brand, across all hubs (read-only, no settlement — internal brand, not external restaurant, per §1)

### 5.3 Shared KDS (Kitchen Display System)

Used by Hub Staff and visible read-only to Hub Manager / Brand Ops Manager:
- Incoming `BrandOrder` card with audible new-order alert
- Accept / Reject buttons, reject requires a reason (feeds the partial-rejection flow in base SDD §2.5)
- Prep-time input/countdown timer per order
- "Mark Ready" button — flips `BrandOrderStatus`, triggers rider-assignment check once *all* `BrandOrder`s under the parent `Order` are ready
- Customer name + any item-level notes visible
- Print kitchen ticket button
- Queue view grouped by status column (New → Preparing → Ready), Trello-style

---

## 6. Delivery Partner App — Screens & UI Features (Detailed)

This is a mobile-first app. One structural note that differs from a generic marketplace rider app: because CraveOS guarantees single-pickup-point fulfillment (base SDD §1.1, §4.4), **a rider's job is always "one hub pickup → one customer drop," even when the order spans multiple brands.** The trip-offer and active-delivery screens below are built around that, not around picking up from N separate restaurants.

### 6.1 Onboarding Flow (first-launch, pre-approval)
- **Screen: Phone Verification** — phone number input, OTP input, resend timer
- **Screen: Personal Details** — name, profile photo upload, emergency contact
- **Screen: Vehicle Details** — vehicle type selector (Bike/Scooter/Bicycle), registration number
- **Screen: Document Upload** — driving licence photo, vehicle RC photo, (Aadhaar/KYC doc), upload progress indicators, retake option
- **Screen: Bank/UPI Details** — UPI ID or bank account + IFSC
- **Screen: Application Submitted** — "Under review" status card, estimated review time, support contact link
- **Push/SMS on approval** — deep-links into the Home dashboard once `Rider.status` flips to `APPROVED`

### 6.2 Home / Dashboard Screen
- **Online/Offline toggle** — large, prominent, top of screen; disabled with tooltip if documents are expired/pending re-verification
- Today's earnings figure (live-updating)
- Today's delivery count
- Current rating (star display)
- Weekly earnings mini-chart
- "You're near a hub" indicator when idle and within range of a hub with pending orders (nudges rider to reposition)
- Incentive progress bar (e.g., "6/10 deliveries — ₹300 bonus at 10")
- Bottom nav: Home / Earnings / Support / Profile

### 6.3 Trip Offer Screen (appears as a modal/overlay when a trip is offered)
- Hub name and pickup address
- **Brand packet count** — e.g., "3 items from 2 brands" (not shown as separate restaurant stops, per the note above)
- Distance to hub (pickup leg)
- Distance from hub to customer (drop leg)
- Estimated total trip time
- Estimated earnings for this trip (base + distance, shown before accept)
- Countdown timer (auto-declines / passes to next rider if not actioned)
- **Accept** / **Reject** buttons
- Reject reason quick-picks (too far, ending shift, vehicle issue)

### 6.4 Active Delivery — Workflow Screens
State machine drives which screen/CTA is shown:

`ASSIGNED → ACCEPTED → ARRIVED_AT_HUB → PICKED_UP → ARRIVING → DELIVERED`

- **En route to hub**: map view, "Arrived at Hub" button (enabled only within geofence radius of hub, prevents false confirmation)
- **At hub**: list of brand packets to collect, checkbox per packet ("BOX8 ✓", "MOJO Pizza ✓"), "Confirm Pickup" button enabled only once all packets checked, hub staff handoff confirmation synced from §5.1
- **En route to customer**: map view with customer marker, live ETA, "Call Customer" / "Message Customer" buttons, "Arrived at Customer" button (geofenced)
- **At customer**: hands off to Delivery Verification screen (§6.6)
- Persistent order-detail drawer throughout: customer name, delivery instructions, items summary, contact-free-delivery flag if set
- Cancel/report-issue option available at every stage, routes into Support (§6.9)

### 6.5 Navigation Screen
- Embedded map (Google Maps) with turn-by-turn route
- Toggle between "Route to Hub" and "Route to Customer" depending on trip stage
- Distance remaining, ETA
- "Open in Google Maps app" fallback button for riders who prefer native navigation
- Traffic-aware route recalculation

### 6.6 Delivery Verification Screen
- **OTP entry field** — rider asks customer for the OTP shown on the customer's tracking screen, enters it here
- OTP mismatch error state with retry
- Optional **photo proof** capture (e.g., left at door)
- Optional customer signature pad, where applicable
- "Confirm Delivery" button — only enabled after successful OTP match
- On success: transitions trip to `DELIVERED`, shows earnings-for-this-trip summary before returning to Home

### 6.7 Earnings Screen
- Filter tabs: Today / This Week / This Month / Custom range
- Breakdown per trip: base fee, distance component, surge (if any), tip, incentive bonus, penalty (if any) — matches `RiderEarning.type` categories
- Running total for selected period
- Payout history list (settled batches, date, amount, status)
- "Next payout" indicator (date/amount pending)
- Download statement (PDF/CSV export)

### 6.8 Incentives Screen
- Active incentive campaigns list (e.g., "Complete 10 deliveries this week → ₹300")
- Progress bar per campaign
- Peak-hour / rain / weekend bonus banners when active, with live multiplier shown
- Area-based incentive map overlay (highlighted zones with bonus pay)
- Completed/expired incentive history

### 6.9 Support Screen
- Quick-action tiles: Report Restaurant Issue, Report Customer Issue, Payment Problem, Order Problem
- **Emergency/Accident button** — prominent, separate styling, triggers immediate escalation (creates `URGENT` priority `Ticket` + optionally surfaces emergency contact info)
- Ticket history with status
- Call Support / Chat Support entry points
- FAQ/help center link

### 6.10 Profile Screen
- Personal info (editable: photo, emergency contact)
- Vehicle info (editable, triggers re-verification if changed)
- Documents section — view uploaded docs, expiry warnings, re-upload flow
- Bank/UPI details (editable)
- Rating breakdown (recent customer feedback snippets)
- Delivery history list, tap-through to trip detail
- Performance stats: acceptance rate, on-time rate, total lifetime deliveries
- Logout / Deactivate account request

---

## 7. Real-Time Event Matrix

| Event | Customer sees | Hub Manager / Hub Staff sees | Brand Ops sees | Rider sees | Admin sees |
|---|---|---|---|---|---|
| Order placed | "Order placed" status | New order on KDS (their hub) | — | — | Live dashboard tick |
| BrandOrder accepted | "Restaurant confirmed" | Own KDS queue updates | Own-brand order count updates | — | Live dashboard tick |
| BrandOrder rejected | Partial-refund notice | Own KDS queue updates | Own-brand cancellation stat updates | — | Cancellation alert |
| All BrandOrders ready | "Preparing your order" → rider search | Ready-for-pickup flag | — | New trip offer | — |
| Rider accepts trip | "Delivery partner assigned" + rider name/rating | Expected rider ETA to hub | — | Trip detail screen | Dispatch console update |
| Rider picked up | Live map begins, ETA shown | Handoff confirmed, order leaves queue | — | Navigation screen switches to drop-leg | Live map update |
| GPS ping (3–5s) | Rider marker moves | — | — | — | Live map update |
| GPS stale (>2 min) | "We're checking on your order" | — | — | — | STALE flag on dispatch console |
| Delivered (OTP confirmed) | "Delivered" + rate-order prompt | Order closed | Own-brand fulfilled count updates | Earnings summary, back to Home | Order closed, revenue ticks |
| Ticket raised | Ticket status in Support widget | — (unless hub-related) | — (unless brand-related) | — (unless rider-related) | New ticket in queue |

---

## 8. Updated Role Permission Matrix (Full)

| Module / Feature | Guest | Customer | Rider | Hub Staff | Hub Manager | Brand Ops Manager | Support Admin | Finance Admin | Ops Admin | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Browse brands & menus | ✅ | ✅ | ❌ | ✅ (own hub) | ✅ (own hub) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Checkout / place order | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (test mode) | ✅ (test mode) |
| View own order history | ❌ | ✅ | ✅ (own trips) | ❌ | ❌ | ❌ | ✅ (any) | ✅ (any) | ✅ (any) | ✅ (any) |
| Accept/reject BrandOrder (KDS) | ❌ | ❌ | ❌ | ✅ | ✅ (view) | ✅ (view, own brand) | ❌ | ❌ | ✅ | ✅ |
| Mark item "86" | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ (own brand) | ❌ | ❌ | ✅ | ✅ |
| Edit menu / pricing | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (own brand) | ❌ | ❌ | ❌ | ✅ |
| Accept trip / update GPS | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Confirm delivery (OTP) | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manually reassign rider | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Issue refund / wallet credit | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (bounded) | ✅ | ✅ | ✅ |
| Approve rider KYC | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Configure Happy Hour / Meal-of-Day | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (propose, own brand) | ❌ | ❌ | ❌ | ✅ (approve/create) |
| Create/edit coupons | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Marketing Admin) |
| View hub financial report | ❌ | ❌ | ❌ | ❌ | ✅ (own hub) | ❌ | ❌ | ✅ (any) | ✅ (any) | ✅ |
| View brand financial report | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (own brand) | ❌ | ✅ (any) | ✅ (any) | ✅ |
| View platform-wide analytics | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage cities / open hubs | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Process rider payouts | ❌ | ❌ | ❌ (view own only) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Manage/resolve tickets | ❌ | ✅ (raise only) | ✅ (raise only) | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Edit CMS (banners, pages) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Marketing Admin) |
| Manage admin accounts / RBAC | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View audit log | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## 9. Open Decisions / Next Steps

1. **Rider multi-drop:** base SDD §7.5 mentions a "configured cap" for concurrent orders but doesn't specify the number or the UI for a rider mid-trip receiving a second offer. Needs a product decision before the Trip Offer screen (§6.3) is finalized for the multi-drop case.
2. **COD:** the base SDD's `paymentMethod` enum includes `"COD"` but no COD-handling screen exists anywhere (Admin reconciliation, rider cash collection confirmation). Either scope it out of V1 explicitly or add the missing screens.
3. **Third-party brand path:** if you want restaurant marketplace features (external onboarding, commission, restaurant-owned bank settlement) in V1 rather than later, this document's Hub/Brand Ops model needs to be extended rather than used as-is — flag this early since it changes the `Brand` model's shape materially.
4. **Ticket ↔ real-time:** decide whether ticket creation/updates go over the same WebSocket channel as order tracking, or a separate one — affects the Support Admin queue's live-update behavior in §4.8.
