# 🚀 CraveOS Implementation Plan — Phase 1: MVP Launch

> **Created:** September 2, 2026  
> **Strategy:** Complete End-to-End Customer Flow (Option A)  
> **Goal:** Launch-ready MVP in 7-9 days  
> **Current Status:** 38% → Target: 70% (MVP Ready)

---

## 📊 Overview

This plan focuses on completing the **critical path to launch**: making the existing customer storefront fully operational from order placement through delivery, with minimal admin tooling to operate the platform.

**What's Already Done:**
- ✅ Complete database schema (18 models, 9 enums)
- ✅ Customer frontend (11 views)
- ✅ Authentication & RBAC system
- ✅ Multi-brand ordering engine
- ✅ Payment integration (Razorpay)
- ✅ Rider management backend
- ✅ Basic logistics module
- ✅ Real-time WebSocket tracking

**What We're Building:**
1. Complete delivery trip workflow (8 new endpoints)
2. Support ticketing system (full CRUD)
3. Minimal admin console (4 key screens + backend)

---

## 🎯 Phase 1: Complete Delivery Trip State Machine

**Goal:** Enable riders to accept trips, confirm pickups, deliver with OTP verification, and earn money  
**Effort:** 2-3 days  
**Priority:** 🔴 CRITICAL — Blocks entire delivery flow  

---

### Task 1.1: Add Trip Workflow Methods to Logistics Service

**File:** `apps/api/src/modules/logistics/logistics.service.ts`

#### Subtask 1.1.1: Implement `acceptTrip` Method
- [ ] **Status:** Not Started
- **What:** Rider confirms they'll take the delivery trip
- **Logic:** 
  - Validate trip is in ASSIGNED status
  - Validate riderId matches trip.riderId
  - Update status: ASSIGNED → ACCEPTED
  - Return updated trip
- **Code:**
```typescript
async acceptTrip(tripId: string, riderId: string): Promise<DeliveryTrip> {
  const trip = await this.prisma.deliveryTrip.findUnique({
    where: { id: tripId },
    include: { order: true },
  });

  if (!trip) {
    throw new NotFoundException(`Trip ${tripId} not found`);
  }

  if (trip.riderId !== riderId) {
    throw new ForbiddenException('This trip is not assigned to you');
  }

  if (trip.status !== 'ASSIGNED') {
    throw new BadRequestException(`Cannot accept trip in status: ${trip.status}`);
  }

  const updated = await this.prisma.deliveryTrip.update({
    where: { id: tripId },
    data: { status: 'ACCEPTED' },
    include: { order: true, rider: true },
  });

  this.logger.log(`✅ Trip ${tripId} accepted by Rider ${riderId}`);

  // WebSocket notification to customer
  this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, {
    status: 'RIDER_ACCEPTED',
    tripId: updated.id,
    riderName: updated.rider?.name,
  });

  return updated;
}
```

#### Subtask 1.1.2: Implement `arrivedAtHub` Method
- [ ] **Status:** Not Started
- **What:** Rider confirms arrival at hub (geofence validated)
- **Logic:**
  - Validate trip is in ACCEPTED status
  - Calculate distance between rider location and hub location
  - If within 100m radius, allow confirmation
  - Update status: ACCEPTED → ARRIVED_AT_HUB
- **Code:**
```typescript
async arrivedAtHub(
  tripId: string,
  riderId: string,
  lat: number,
  lng: number,
): Promise<DeliveryTrip> {
  const trip = await this.prisma.deliveryTrip.findUnique({
    where: { id: tripId },
    include: { order: { include: { hub: true } } },
  });

  if (!trip) {
    throw new NotFoundException(`Trip ${tripId} not found`);
  }

  if (trip.riderId !== riderId) {
    throw new ForbiddenException('This trip is not assigned to you');
  }

  if (trip.status !== 'ACCEPTED') {
    throw new BadRequestException(`Cannot confirm hub arrival in status: ${trip.status}`);
  }

  // Geofence validation: calculate distance
  const hubLat = trip.order.hub.lat;
  const hubLng = trip.order.hub.lng;
  const distance = this.calculateDistance(lat, lng, hubLat, hubLng);

  if (distance > 0.1) { // 100 meters
    throw new BadRequestException(
      `You are ${Math.round(distance * 1000)}m away from the hub. Please move closer to confirm arrival.`,
    );
  }

  const updated = await this.prisma.deliveryTrip.update({
    where: { id: tripId },
    data: { status: 'ARRIVED_AT_HUB' },
  });

  this.logger.log(`🏢 Rider ${riderId} arrived at hub for Trip ${tripId}`);

  // WebSocket notification to hub KDS
  this.websocketsGateway.emitToKDS(trip.order.hubId, {
    event: 'riderArrivedAtHub',
    tripId,
    orderId: trip.orderId,
  });

  return updated;
}

// Helper method for geofence calculation
private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = this.toRad(lat2 - lat1);
  const dLng = this.toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

private toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
```

#### Subtask 1.1.3: Implement `confirmPickup` Method
- [ ] **Status:** Not Started
- **What:** Rider confirms they've picked up the order from the hub
- **Logic:**
  - Validate trip is in ARRIVED_AT_HUB status
  - Generate 4-digit OTP
  - Update status: ARRIVED_AT_HUB → PICKED_UP
  - Store OTP in deliveryOtp field
  - Return trip with OTP (to display to customer)
- **Code:**
```typescript
async confirmPickup(
  tripId: string,
  riderId: string,
): Promise<{ trip: DeliveryTrip; otp: string }> {
  const trip = await this.prisma.deliveryTrip.findUnique({
    where: { id: tripId },
  });

  if (!trip) {
    throw new NotFoundException(`Trip ${tripId} not found`);
  }

  if (trip.riderId !== riderId) {
    throw new ForbiddenException('This trip is not assigned to you');
  }

  if (trip.status !== 'ARRIVED_AT_HUB') {
    throw new BadRequestException(`Cannot confirm pickup in status: ${trip.status}`);
  }

  // Generate 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  const updated = await this.prisma.deliveryTrip.update({
    where: { id: tripId },
    data: {
      status: 'PICKED_UP',
      deliveryOtp: otp,
    },
  });

  this.logger.log(`📦 Trip ${tripId} picked up by Rider ${riderId} — OTP: ${otp}`);

  // WebSocket: notify customer with live tracking
  this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, {
    status: 'OUT_FOR_DELIVERY',
    otp, // Show OTP to customer
    tripId: updated.id,
  });

  return { trip: updated, otp };
}
```

#### Subtask 1.1.4: Implement `arrivedAtCustomer` Method
- [ ] **Status:** Not Started
- **What:** Rider confirms arrival at customer location (geofence validated)
- **Logic:**
  - Validate trip is in PICKED_UP status
  - Calculate distance to customer address
  - If within 50m, allow confirmation
  - Update status: PICKED_UP → ARRIVING
- **Code:**
```typescript
async arrivedAtCustomer(
  tripId: string,
  riderId: string,
  lat: number,
  lng: number,
): Promise<DeliveryTrip> {
  const trip = await this.prisma.deliveryTrip.findUnique({
    where: { id: tripId },
    include: { order: { include: { address: true } } },
  });

  if (!trip) {
    throw new NotFoundException(`Trip ${tripId} not found`);
  }

  if (trip.riderId !== riderId) {
    throw new ForbiddenException('This trip is not assigned to you');
  }

  if (trip.status !== 'PICKED_UP') {
    throw new BadRequestException(`Cannot confirm customer arrival in status: ${trip.status}`);
  }

  // Geofence validation
  const customerLat = trip.order.address.lat;
  const customerLng = trip.order.address.lng;
  const distance = this.calculateDistance(lat, lng, customerLat, customerLng);

  if (distance > 0.05) { // 50 meters
    throw new BadRequestException(
      `You are ${Math.round(distance * 1000)}m away from the delivery location. Please move closer.`,
    );
  }

  const updated = await this.prisma.deliveryTrip.update({
    where: { id: tripId },
    data: { status: 'ARRIVING' },
  });

  this.logger.log(`🏠 Rider ${riderId} arrived at customer for Trip ${tripId}`);

  // WebSocket: notify customer to prepare for handoff
  this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, {
    status: 'RIDER_ARRIVED',
    message: 'Your delivery partner has arrived!',
  });

  return updated;
}
```

#### Subtask 1.1.5: Implement `verifyDeliveryOtp` Method
- [ ] **Status:** Not Started
- **What:** Rider enters customer's OTP to complete delivery
- **Logic:**
  - Validate trip is in ARRIVING status
  - Compare entered OTP with stored deliveryOtp
  - If match: Update status: ARRIVING → DELIVERED
  - Set otpVerifiedAt timestamp
  - Create RiderEarning records (BASE_FEE + DISTANCE_FEE)
  - Update Order status to DELIVERED
- **Code:**
```typescript
async verifyDeliveryOtp(
  tripId: string,
  riderId: string,
  otp: string,
  proofPhotoUrl?: string,
): Promise<DeliveryTrip> {
  const trip = await this.prisma.deliveryTrip.findUnique({
    where: { id: tripId },
    include: { order: { include: { address: true, hub: true } } },
  });

  if (!trip) {
    throw new NotFoundException(`Trip ${tripId} not found`);
  }

  if (trip.riderId !== riderId) {
    throw new ForbiddenException('This trip is not assigned to you');
  }

  if (trip.status !== 'ARRIVING') {
    throw new BadRequestException(`Cannot verify OTP in status: ${trip.status}`);
  }

  if (trip.deliveryOtp !== otp) {
    throw new BadRequestException('Incorrect OTP. Please verify with the customer.');
  }

  // Calculate distance-based earnings
  const distanceKm = this.calculateDistance(
    trip.order.hub.lat,
    trip.order.hub.lng,
    trip.order.address.lat,
    trip.order.address.lng,
  );

  const baseFee = 3000; // ₹30 base
  const distanceFee = Math.floor(distanceKm * 800); // ₹8/km

  // Use transaction to ensure atomicity
  const [updated] = await this.prisma.$transaction([
    // Update trip status
    this.prisma.deliveryTrip.update({
      where: { id: tripId },
      data: {
        status: 'DELIVERED',
        otpVerifiedAt: new Date(),
        proofPhotoUrl: proofPhotoUrl || null,
      },
    }),

    // Update order status
    this.prisma.order.update({
      where: { id: trip.orderId },
      data: { status: 'DELIVERED' },
    }),

    // Create rider earnings
    this.prisma.riderEarning.create({
      data: {
        riderId,
        tripId,
        type: 'BASE_FEE',
        amountInPaise: baseFee,
      },
    }),

    this.prisma.riderEarning.create({
      data: {
        riderId,
        tripId,
        type: 'DISTANCE_FEE',
        amountInPaise: distanceFee,
      },
    }),
  ]);

  this.logger.log(
    `✅ Trip ${tripId} DELIVERED — Rider ${riderId} earned ₹${(baseFee + distanceFee) / 100}`,
  );

  // WebSocket: notify customer of delivery completion
  this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, {
    status: 'DELIVERED',
    deliveredAt: new Date(),
    message: 'Your order has been delivered! Enjoy your meal 🍽️',
  });

  return updated;
}
```

#### Subtask 1.1.6: Implement `rejectTrip` Method
- [ ] **Status:** Not Started
- **What:** Rider declines the trip offer
- **Logic:**
  - Validate trip is in ASSIGNED status
  - Update status: ASSIGNED → UNASSIGNED
  - Clear riderId
  - Trip becomes available for next rider
- **Code:**
```typescript
async rejectTrip(tripId: string, riderId: string, reason: string): Promise<DeliveryTrip> {
  const trip = await this.prisma.deliveryTrip.findUnique({
    where: { id: tripId },
  });

  if (!trip) {
    throw new NotFoundException(`Trip ${tripId} not found`);
  }

  if (trip.riderId !== riderId) {
    throw new ForbiddenException('This trip is not assigned to you');
  }

  if (trip.status !== 'ASSIGNED') {
    throw new BadRequestException(`Cannot reject trip in status: ${trip.status}`);
  }

  const updated = await this.prisma.deliveryTrip.update({
    where: { id: tripId },
    data: {
      status: 'UNASSIGNED',
      riderId: null,
    },
  });

  this.logger.warn(`⚠️ Trip ${tripId} rejected by Rider ${riderId} — Reason: ${reason}`);

  // TODO: Re-trigger auto-assignment to find another rider

  return updated;
}
```

#### Subtask 1.1.7: Implement `cancelTrip` Method
- [ ] **Status:** Not Started
- **What:** Admin or system cancels a trip
- **Logic:**
  - Any status → CANCELLED
  - Log cancellation reason
- **Code:**
```typescript
async cancelTrip(tripId: string, reason: string): Promise<DeliveryTrip> {
  const trip = await this.prisma.deliveryTrip.findUnique({
    where: { id: tripId },
  });

  if (!trip) {
    throw new NotFoundException(`Trip ${tripId} not found`);
  }

  const updated = await this.prisma.deliveryTrip.update({
    where: { id: tripId },
    data: { status: 'CANCELLED' },
  });

  this.logger.warn(`❌ Trip ${tripId} CANCELLED — Reason: ${reason}`);

  // WebSocket: notify customer
  this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, {
    status: 'DELIVERY_CANCELLED',
    reason,
  });

  return updated;
}
```

#### Subtask 1.1.8: Implement `getRiderActiveTrip` Method
- [ ] **Status:** Not Started
- **What:** Get rider's current active trip
- **Code:**
```typescript
async getRiderActiveTrip(riderId: string): Promise<DeliveryTrip | null> {
  return this.prisma.deliveryTrip.findFirst({
    where: {
      riderId,
      status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING'] },
    },
    include: {
      order: {
        include: {
          address: true,
          hub: true,
          brandOrders: {
            include: { items: true },
          },
        },
      },
    },
  });
}
```

#### Subtask 1.1.9: Implement `getRiderTripHistory` Method
- [ ] **Status:** Not Started
- **What:** Get rider's past completed trips
- **Code:**
```typescript
async getRiderTripHistory(riderId: string): Promise<DeliveryTrip[]> {
  return this.prisma.deliveryTrip.findMany({
    where: {
      riderId,
      status: { in: ['DELIVERED', 'CANCELLED'] },
    },
    include: {
      order: {
        include: {
          address: true,
          brandOrders: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
```

---

### Task 1.2: Add Trip Endpoints to Logistics Controller

**File:** `apps/api/src/modules/logistics/logistics.controller.ts`

#### Subtask 1.2.1: Add All New Endpoints
- [ ] **Status:** Not Started
- **Code:**
```typescript
import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  // Existing endpoints...
  @Post('auto-assign/:orderId')
  async autoAssignRider(@Param('orderId') orderId: string) {
    return this.logisticsService.autoAssignRider(orderId);
  }

  @Post('rider/:id/location')
  async updateRiderLocation(
    @Param('id') riderId: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.logisticsService.updateRiderLocation(riderId, body);
  }

  @Get('trips')
  async getActiveTrips() {
    return this.logisticsService.getActiveTrips();
  }

  // NEW: Trip workflow endpoints
  @Post('trips/:id/accept')
  @Roles('RIDER')
  async acceptTrip(
    @Param('id') tripId: string,
    @Body('riderId') riderId: string,
  ) {
    return this.logisticsService.acceptTrip(tripId, riderId);
  }

  @Post('trips/:id/arrived-hub')
  @Roles('RIDER')
  async arrivedAtHub(
    @Param('id') tripId: string,
    @Body() body: { riderId: string; lat: number; lng: number },
  ) {
    return this.logisticsService.arrivedAtHub(tripId, body.riderId, body.lat, body.lng);
  }

  @Post('trips/:id/pickup')
  @Roles('RIDER')
  async confirmPickup(
    @Param('id') tripId: string,
    @Body('riderId') riderId: string,
  ) {
    return this.logisticsService.confirmPickup(tripId, riderId);
  }

  @Post('trips/:id/arrived-customer')
  @Roles('RIDER')
  async arrivedAtCustomer(
    @Param('id') tripId: string,
    @Body() body: { riderId: string; lat: number; lng: number },
  ) {
    return this.logisticsService.arrivedAtCustomer(tripId, body.riderId, body.lat, body.lng);
  }

  @Post('trips/:id/deliver')
  @Roles('RIDER')
  async verifyDeliveryOtp(
    @Param('id') tripId: string,
    @Body() body: { riderId: string; otp: string; proofPhotoUrl?: string },
  ) {
    return this.logisticsService.verifyDeliveryOtp(
      tripId,
      body.riderId,
      body.otp,
      body.proofPhotoUrl,
    );
  }

  @Post('trips/:id/reject')
  @Roles('RIDER')
  async rejectTrip(
    @Param('id') tripId: string,
    @Body() body: { riderId: string; reason: string },
  ) {
    return this.logisticsService.rejectTrip(tripId, body.riderId, body.reason);
  }

  @Get('trips/rider/:riderId/active')
  @Roles('RIDER', 'ADMIN')
  async getRiderActiveTrip(@Param('riderId') riderId: string) {
    return this.logisticsService.getRiderActiveTrip(riderId);
  }

  @Get('trips/rider/:riderId/history')
  @Roles('RIDER', 'ADMIN')
  async getRiderTripHistory(@Param('riderId') riderId: string) {
    return this.logisticsService.getRiderTripHistory(riderId);
  }
}
```

---

### Task 1.3: Refactor autoAssignRider to Use Rider Model

**File:** `apps/api/src/modules/logistics/logistics.service.ts`

#### Subtask 1.3.1: Update Rider Query Logic
- [ ] **Status:** Not Started
- **What:** Query Rider model instead of User model
- **Find and replace this section:**
```typescript
// OLD (current implementation):
const busyRiderIds = await this.prisma.deliveryTrip
  .findMany({
    where: { status: { in: ['ASSIGNED', 'PICKED_UP'] } },
    select: { riderId: true },
  })
  .then((trips) => trips.map((t) => t.riderId).filter(Boolean) as string[]);

const rider = await this.prisma.user.findFirst({
  where: {
    id: busyRiderIds.length > 0 ? { notIn: busyRiderIds } : undefined,
  },
});
```

**With:**
```typescript
// NEW (use Rider model with proper filters):
const busyRiderIds = await this.prisma.deliveryTrip
  .findMany({
    where: {
      status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING'] },
    },
    select: { riderId: true },
  })
  .then((trips) => trips.map((t) => t.riderId).filter(Boolean) as string[]);

// Prefer riders at the same hub
let rider = await this.prisma.rider.findFirst({
  where: {
    status: 'APPROVED',
    isOnline: true,
    currentHubId: order.hubId,
    id: busyRiderIds.length > 0 ? { notIn: busyRiderIds } : undefined,
  },
  orderBy: { rating: 'desc' }, // Prioritize higher-rated riders
});

// If no rider at same hub, try any available rider
if (!rider) {
  rider = await this.prisma.rider.findFirst({
    where: {
      status: 'APPROVED',
      isOnline: true,
      id: busyRiderIds.length > 0 ? { notIn: busyRiderIds } : undefined,
    },
    orderBy: { rating: 'desc' },
  });
}
```

---

### Task 1.4: Update Stale Tracking Cron

**File:** `apps/api/src/modules/logistics/stale-tracking-cron.service.ts`

#### Subtask 1.4.1: Use lastPingAt Field
- [ ] **Status:** Not Started
- **What:** Check lastPingAt instead of updatedAt for stale detection
- **Update the cron method:**
```typescript
@Cron('*/2 * * * *') // Every 2 minutes
async detectStaleTrips() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const staleTrips = await this.prisma.deliveryTrip.findMany({
    where: {
      status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ARRIVING'] },
      lastPingAt: {
        lt: twoMinutesAgo,
      },
    },
    include: { order: true },
  });

  if (staleTrips.length > 0) {
    this.logger.warn(`⚠️ Detected ${staleTrips.length} stale trips (no GPS ping for 2+ minutes)`);

    // Update to STALE status
    await this.prisma.deliveryTrip.updateMany({
      where: { id: { in: staleTrips.map((t) => t.id) } },
      data: { status: 'STALE' },
    });

    // WebSocket: notify admin dashboard
    staleTrips.forEach((trip) => {
      this.websocketsGateway.emitToAdmin({
        event: 'tripStale',
        tripId: trip.id,
        orderId: trip.orderId,
      });
    });
  }
}
```

#### Subtask 1.4.2: Update updateRiderLocation to Set lastPingAt
- [ ] **Status:** Not Started
- **File:** `apps/api/src/modules/logistics/logistics.service.ts`
- **Update in updateRiderLocation method:**
```typescript
const updatedTrip = await this.prisma.deliveryTrip.update({
  where: { id: activeTrip.id },
  data: {
    liveLat: location.lat,
    liveLng: location.lng,
    lastPingAt: new Date(), // ADD THIS LINE
  },
});
```

---

### Task 1.5: Update API Client for Trip Endpoints

**File:** `src/lib/api-client.ts`

#### Subtask 1.5.1: Add Logistics Trip Endpoints
- [ ] **Status:** Not Started
- **Add to api object:**
```typescript
export const api = {
  // ... existing endpoints ...

  // Logistics — ADD THESE
  logistics: {
    autoAssignRider: (orderId: string) =>
      apiRequest(`/logistics/auto-assign/${orderId}`, { method: 'POST' }),
    
    getActiveTrips: () => apiRequest('/logistics/trips'),
    
    // NEW: Trip workflow endpoints
    acceptTrip: (tripId: string, riderId: string) =>
      apiRequest(`/logistics/trips/${tripId}/accept`, {
        method: 'POST',
        body: JSON.stringify({ riderId }),
      }),
    
    arrivedAtHub: (tripId: string, riderId: string, lat: number, lng: number) =>
      apiRequest(`/logistics/trips/${tripId}/arrived-hub`, {
        method: 'POST',
        body: JSON.stringify({ riderId, lat, lng }),
      }),
    
    confirmPickup: (tripId: string, riderId: string) =>
      apiRequest(`/logistics/trips/${tripId}/pickup`, {
        method: 'POST',
        body: JSON.stringify({ riderId }),
      }),
    
    arrivedAtCustomer: (tripId: string, riderId: string, lat: number, lng: number) =>
      apiRequest(`/logistics/trips/${tripId}/arrived-customer`, {
        method: 'POST',
        body: JSON.stringify({ riderId, lat, lng }),
      }),
    
    verifyDeliveryOtp: (tripId: string, riderId: string, otp: string, proofPhotoUrl?: string) =>
      apiRequest(`/logistics/trips/${tripId}/deliver`, {
        method: 'POST',
        body: JSON.stringify({ riderId, otp, proofPhotoUrl }),
      }),
    
    rejectTrip: (tripId: string, riderId: string, reason: string) =>
      apiRequest(`/logistics/trips/${tripId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ riderId, reason }),
      }),
    
    getRiderActiveTrip: (riderId: string) =>
      apiRequest(`/logistics/trips/rider/${riderId}/active`),
    
    getRiderTripHistory: (riderId: string) =>
      apiRequest(`/logistics/trips/rider/${riderId}/history`),
  },
};
```

---

### Task 1.6: Testing & Verification

#### Subtask 1.6.1: Manual API Testing
- [ ] **Status:** Not Started
- **Steps:**
  1. Start backend: `cd apps/api && npm run start:dev`
  2. Create a test order via customer frontend
  3. Get a rider token (register + verify OTP as rider)
  4. Test each endpoint in sequence:
```bash
# 1. Accept trip
curl -X POST http://localhost:4000/api/v1/logistics/trips/{tripId}/accept \
  -H "Authorization: Bearer {riderToken}" \
  -H "Content-Type: application/json" \
  -d '{"riderId": "{riderId}"}'

# 2. Arrive at hub (use actual hub coordinates)
curl -X POST http://localhost:4000/api/v1/logistics/trips/{tripId}/arrived-hub \
  -H "Authorization: Bearer {riderToken}" \
  -H "Content-Type: application/json" \
  -d '{"riderId": "{riderId}", "lat": 12.9716, "lng": 77.5946}'

# 3. Confirm pickup (will return OTP)
curl -X POST http://localhost:4000/api/v1/logistics/trips/{tripId}/pickup \
  -H "Authorization: Bearer {riderToken}" \
  -H "Content-Type: application/json" \
  -d '{"riderId": "{riderId}"}'

# 4. Arrive at customer
curl -X POST http://localhost:4000/api/v1/logistics/trips/{tripId}/arrived-customer \
  -H "Authorization: Bearer {riderToken}" \
  -H "Content-Type: application/json" \
  -d '{"riderId": "{riderId}", "lat": 12.9352, "lng": 77.6245}'

# 5. Verify OTP and deliver
curl -X POST http://localhost:4000/api/v1/logistics/trips/{tripId}/deliver \
  -H "Authorization: Bearer {riderToken}" \
  -H "Content-Type: application/json" \
  -d '{"riderId": "{riderId}", "otp": "1234"}'
```

#### Subtask 1.6.2: Verify Database Changes
- [ ] **Status:** Not Started
- **Check:**
  1. DeliveryTrip status transitions correctly
  2. deliveryOtp is set after pickup
  3. otpVerifiedAt is set after delivery
  4. RiderEarning records created (BASE_FEE + DISTANCE_FEE)
  5. Order status updated to DELIVERED

#### Subtask 1.6.3: Verify WebSocket Events
- [ ] **Status:** Not Started
- **Check:**
  1. Customer receives real-time updates at each step
  2. KDS receives rider arrival notification
  3. Admin dashboard shows trip status changes

---

## 🎯 Phase 2: Ticketing & Support System

**Goal:** Enable customers, riders, and staff to create and manage support tickets  
**Effort:** 1-2 days  
**Priority:** 🟡 HIGH — Essential for customer support operations

---

### Task 2.1: Create Tickets Module Structure

**Directory:** `apps/api/src/modules/tickets/`

#### Subtask 2.1.1: Create Module Files
- [ ] **Status:** Not Started
- **Files to create:**
  1. `tickets.module.ts`
  2. `tickets.service.ts`
  3. `tickets.controller.ts`

---

### Task 2.2: Implement Tickets Service

**File:** `apps/api/src/modules/tickets/tickets.service.ts`

#### Subtask 2.2.1: Create DTOs and Interfaces
- [ ] **Status:** Not Started
- **Code:**
```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

interface CreateTicketDto {
  raisedByType: 'CUSTOMER' | 'HUB' | 'BRAND_OPS' | 'RIDER';
  raisedById: string;
  orderId?: string;
  category: string; // MISSING_ITEM | WRONG_ITEM | LATE_DELIVERY | PAYMENT_ISSUE | RIDER_SAFETY | OTHER
  priority?: string; // LOW | NORMAL | HIGH | URGENT
  description: string;
}

interface TicketFilters {
  status?: TicketStatus;
  category?: string;
  priority?: string;
  raisedByType?: string;
}
```

#### Subtask 2.2.2: Implement Service Methods
- [ ] **Status:** Not Started
- **Code:**
```typescript
@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTicket(data: CreateTicketDto) {
    const ticket = await this.prisma.ticket.create({
      data: {
        raisedByType: data.raisedByType,
        raisedById: data.raisedById,
        orderId: data.orderId || null,
        category: data.category,
        priority: data.priority || 'NORMAL',
        status: 'OPEN',
      },
    });

    this.logger.log(
      `🎫 New ${data.priority || 'NORMAL'} ticket created: ${ticket.id} by ${data.raisedByType}`,
    );

    // TODO: WebSocket event to admin tickets room
    // this.websocketsGateway.emitToAdminTickets({ event: 'ticketCreated', ticket });

    return ticket;
  }

  async getTickets(filters?: TicketFilters) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.raisedByType) where.raisedByType = filters.raisedByType;

    return this.prisma.ticket.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getTicketById(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }

  async assignTicket(id: string, staffId: string) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: {
        assignedToId: staffId,
        status: 'ASSIGNED',
      },
    });

    this.logger.log(`🎫 Ticket ${id} assigned to staff ${staffId}`);

    return ticket;
  }

  async updateTicketStatus(id: string, status: TicketStatus) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status },
    });

    this.logger.log(`🎫 Ticket ${id} status updated to ${status}`);

    return ticket;
  }

  async resolveTicket(id: string, note: string) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolutionNote: note,
        resolvedAt: new Date(),
      },
    });

    this.logger.log(`✅ Ticket ${id} resolved`);

    // TODO: Notify ticket raiser

    return ticket;
  }

  async getUserTickets(userId: string) {
    return this.prisma.ticket.findMany({
      where: { raisedById: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicketStats() {
    const [open, assigned, inProgress, resolved] = await Promise.all([
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
      this.prisma.ticket.count({ where: { status: 'ASSIGNED' } }),
      this.prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.ticket.count({ where: { status: 'RESOLVED' } }),
    ]);

    return {
      open,
      assigned,
      inProgress,
      resolved,
      total: open + assigned + inProgress + resolved,
    };
  }
}
```

---

### Task 2.3: Implement Tickets Controller

**File:** `apps/api/src/modules/tickets/tickets.controller.ts`

#### Subtask 2.3.1: Add Controller with RBAC Guards
- [ ] **Status:** Not Started
- **Code:**
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Roles, AdminSubRoles } from '../../common/decorators/roles.decorator';
import { TicketStatus } from '@prisma/client';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @Roles('CUSTOMER', 'RIDER', 'HUB_STAFF', 'BRAND_OPS', 'ADMIN')
  async createTicket(@Body() data: any) {
    return this.ticketsService.createTicket(data);
  }

  @Get()
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getTickets(
    @Query('status') status?: TicketStatus,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('raisedByType') raisedByType?: string,
  ) {
    return this.ticketsService.getTickets({ status, category, priority, raisedByType });
  }

  @Get('stats')
  @Roles('ADMIN')
  async getTicketStats() {
    return this.ticketsService.getTicketStats();
  }

  @Get(':id')
  @Roles('ADMIN', 'CUSTOMER', 'RIDER', 'HUB_STAFF', 'BRAND_OPS')
  async getTicketById(@Param('id') id: string) {
    // TODO: Add ownership check for non-admin users
    return this.ticketsService.getTicketById(id);
  }

  @Patch(':id/assign')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'SUPER_ADMIN')
  async assignTicket(@Param('id') id: string, @Body('staffId') staffId: string) {
    return this.ticketsService.assignTicket(id, staffId);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'SUPER_ADMIN')
  async updateTicketStatus(@Param('id') id: string, @Body('status') status: TicketStatus) {
    return this.ticketsService.updateTicketStatus(id, status);
  }

  @Patch(':id/resolve')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'SUPER_ADMIN')
  async resolveTicket(@Param('id') id: string, @Body('note') note: string) {
    return this.ticketsService.resolveTicket(id, note);
  }

  @Get('user/:userId')
  @Roles('CUSTOMER', 'RIDER', 'ADMIN')
  async getUserTickets(@Param('userId') userId: string) {
    return this.ticketsService.getUserTickets(userId);
  }
}
```

---

### Task 2.4: Create Tickets Module

**File:** `apps/api/src/modules/tickets/tickets.module.ts`

#### Subtask 2.4.1: Wire Up Module
- [ ] **Status:** Not Started
- **Code:**
```typescript
import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
```

---

### Task 2.5: Register Tickets Module in App

**File:** `apps/api/src/app.module.ts`

#### Subtask 2.5.1: Add to Imports
- [ ] **Status:** Not Started
- **Add:**
```typescript
import { TicketsModule } from './modules/tickets/tickets.module';

@Module({
  imports: [
    // ... existing imports ...
    TicketsModule, // ADD THIS
  ],
  // ...
})
export class AppModule {}
```

---

### Task 2.6: Update API Client

**File:** `src/lib/api-client.ts`

#### Subtask 2.6.1: Add Tickets Endpoints
- [ ] **Status:** Not Started
- **Add:**
```typescript
export const api = {
  // ... existing ...

  tickets: {
    create: (data: any) =>
      apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    getAll: (filters?: any) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.priority) params.append('priority', filters.priority);
      return apiRequest(`/tickets?${params.toString()}`);
    },
    
    getById: (id: string) => apiRequest(`/tickets/${id}`),
    
    assign: (id: string, staffId: string) =>
      apiRequest(`/tickets/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ staffId }),
      }),
    
    updateStatus: (id: string, status: string) =>
      apiRequest(`/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    
    resolve: (id: string, note: string) =>
      apiRequest(`/tickets/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
      }),
    
    getUserTickets: (userId: string) => apiRequest(`/tickets/user/${userId}`),
    
    getStats: () => apiRequest('/tickets/stats'),
  },
};
```

---

### Task 2.7: Testing

#### Subtask 2.7.1: Test Ticket Creation
- [ ] **Status:** Not Started
- **Steps:**
```bash
# Create a ticket
curl -X POST http://localhost:4000/api/v1/tickets \
  -H "Authorization: Bearer {customerToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "raisedByType": "CUSTOMER",
    "raisedById": "{userId}",
    "orderId": "{orderId}",
    "category": "MISSING_ITEM",
    "priority": "HIGH",
    "description": "Pizza missing from order"
  }'
```

#### Subtask 2.7.2: Verify Database
- [ ] **Status:** Not Started
- Check Ticket record created with correct status

---

## 🎯 Phase 3: Minimal Admin Console

**Goal:** Build essential admin backend + frontend to operate the platform  
**Effort:** 3-4 days  
**Priority:** 🟡 HIGH — Required for operations

---

### Task 3.1: Create Admin Module Backend

**Directory:** `apps/api/src/modules/admin/`

#### Subtask 3.1.1: Create Module Files
- [ ] **Status:** Not Started
- **Files:**
  1. `admin.module.ts`
  2. `admin.service.ts`
  3. `admin.controller.ts`

---

### Task 3.2: Implement Admin Service

**File:** `apps/api/src/modules/admin/admin.service.ts`

#### Subtask 3.2.1: Dashboard Methods
- [ ] **Status:** Not Started
- **Code:**
```typescript
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardKPIs() {
    const [
      totalOrders,
      todayOrders,
      activeRiders,
      pendingRiderApprovals,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.rider.count({
        where: { isOnline: true, status: 'APPROVED' },
      }),
      this.prisma.rider.count({
        where: { status: 'PENDING_APPROVAL' },
      }),
    ]);

    return {
      totalOrders,
      todayOrders,
      activeRiders,
      pendingRiderApprovals,
    };
  }

  async getLiveOrdersMap() {
    return this.prisma.deliveryTrip.findMany({
      where: {
        status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ARRIVING'] },
      },
      include: {
        order: {
          include: {
            address: true,
            hub: true,
          },
        },
        rider: {
          select: {
            id: true,
            name: true,
            phone: true,
            liveLat: true,
            liveLng: true,
          },
        },
      },
    });
  }
}
```

#### Subtask 3.2.2: User Management Methods
- [ ] **Status:** Not Started
- **Code:**
```typescript
async getUsers(filters?: any) {
  const where: any = {};
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
    ];
  }

  return this.prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      walletBalance: true,
      createdAt: true,
      membership: {
        select: {
          status: true,
          planId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

async getUserById(id: string) {
  const user = await this.prisma.user.findUnique({
    where: { id },
    include: {
      addresses: true,
      orders: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
      walletTxns: {
        take: 20,
        orderBy: { createdAt: 'desc' },
      },
      membership: true,
    },
  });

  if (!user) {
    throw new NotFoundException(`User ${id} not found`);
  }

  return user;
}

async adjustWallet(userId: string, amountInPaise: number, reason: string) {
  return this.prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        walletBalance: {
          increment: amountInPaise,
        },
      },
    });

    await tx.walletTransaction.create({
      data: {
        userId,
        amountInPaise,
        reason,
      },
    });

    return user;
  });
}
```

#### Subtask 3.2.3: Order Management Methods
- [ ] **Status:** Not Started
- **Code:**
```typescript
async getOrders(filters?: any) {
  const where: any = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.hubId) where.hubId = filters.hubId;

  return this.prisma.order.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, phone: true },
      },
      address: true,
      brandOrders: {
        include: {
          items: true,
        },
      },
      deliveryTrip: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

async manuallyReassignRider(orderId: string, newRiderId: string) {
  const trip = await this.prisma.deliveryTrip.findUnique({
    where: { orderId },
  });

  if (!trip) {
    throw new NotFoundException(`No delivery trip found for order ${orderId}`);
  }

  return this.prisma.deliveryTrip.update({
    where: { id: trip.id },
    data: { riderId: newRiderId },
  });
}
```

---

### Task 3.3: Implement Admin Controller

**File:** `apps/api/src/modules/admin/admin.controller.ts`

#### Subtask 3.3.1: Add All Admin Endpoints
- [ ] **Status:** Not Started
- **Code:**
```typescript
import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles, AdminSubRoles } from '../../common/decorators/roles.decorator';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Dashboard
  @Get('dashboard/kpis')
  @Roles('ADMIN')
  async getDashboardKPIs() {
    return this.adminService.getDashboardKPIs();
  }

  @Get('dashboard/live-orders')
  @Roles('ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getLiveOrdersMap() {
    return this.adminService.getLiveOrdersMap();
  }

  // User Management
  @Get('users')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async getUsers(@Query('search') search?: string) {
    return this.adminService.getUsers({ search });
  }

  @Get('users/:id')
  @Roles('ADMIN')
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Post('users/:id/wallet-adjust')
  @Roles('ADMIN')
  @AdminSubRoles('SUPPORT_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN')
  async adjustWallet(
    @Param('id') id: string,
    @Body() body: { amountInPaise: number; reason: string },
  ) {
    return this.adminService.adjustWallet(id, body.amountInPaise, body.reason);
  }

  // Order Management
  @Get('orders')
  @Roles('ADMIN')
  async getOrders(
    @Query('status') status?: string,
    @Query('hubId') hubId?: string,
  ) {
    return this.adminService.getOrders({ status, hubId });
  }

  @Post('orders/:id/reassign-rider')
  @Roles('ADMIN')
  @AdminSubRoles('OPERATIONS_ADMIN', 'SUPER_ADMIN')
  async manuallyReassignRider(
    @Param('id') orderId: string,
    @Body('riderId') riderId: string,
  ) {
    return this.adminService.manuallyReassignRider(orderId, riderId);
  }
}
```

---

### Task 3.4: Create Admin Module & Register

**Files:** `admin.module.ts` + `app.module.ts`

#### Subtask 3.4.1: Create Module
- [ ] **Status:** Not Started
- **Code:**
```typescript
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

#### Subtask 3.4.2: Register in App Module
- [ ] **Status:** Not Started
- **Add to** `apps/api/src/app.module.ts`:
```typescript
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    // ... existing ...
    AdminModule, // ADD THIS
  ],
})
```

---

### Task 3.5: Update API Client

**File:** `src/lib/api-client.ts`

#### Subtask 3.5.1: Add Admin & Riders Endpoints
- [ ] **Status:** Not Started
- **Add:**
```typescript
export const api = {
  // ... existing ...

  admin: {
    getDashboardKPIs: () => apiRequest('/admin/dashboard/kpis'),
    getLiveOrdersMap: () => apiRequest('/admin/dashboard/live-orders'),
    getUsers: (search?: string) => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      return apiRequest(`/admin/users${params}`);
    },
    getUserById: (id: string) => apiRequest(`/admin/users/${id}`),
    adjustWallet: (id: string, amountInPaise: number, reason: string) =>
      apiRequest(`/admin/users/${id}/wallet-adjust`, {
        method: 'POST',
        body: JSON.stringify({ amountInPaise, reason }),
      }),
    getOrders: (filters?: any) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.hubId) params.append('hubId', filters.hubId);
      return apiRequest(`/admin/orders?${params.toString()}`);
    },
    manuallyReassignRider: (orderId: string, riderId: string) =>
      apiRequest(`/admin/orders/${orderId}/reassign-rider`, {
        method: 'POST',
        body: JSON.stringify({ riderId }),
      }),
  },

  riders: {
    getApprovalQueue: () => apiRequest('/riders/approval-queue'),
    getAll: (filters?: any) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.hubId) params.append('hubId', filters.hubId);
      if (filters?.isOnline !== undefined) params.append('isOnline', filters.isOnline);
      return apiRequest(`/riders?${params.toString()}`);
    },
    getById: (id: string) => apiRequest(`/riders/${id}`),
    updateStatus: (id: string, status: string, reason?: string) =>
      apiRequest(`/riders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      }),
    toggleOnline: (id: string, isOnline: boolean) =>
      apiRequest(`/riders/${id}/online`, {
        method: 'PATCH',
        body: JSON.stringify({ isOnline }),
      }),
  },
};
```

---

### Task 3.6: Build Admin Frontend Views

**Directory:** `src/views/admin/`

#### Subtask 3.6.1: Create AdminDashboardView.tsx
- [ ] **Status:** Not Started
- **What:** KPI tiles, live order map, recent orders table
- **Effort:** ~300 lines

#### Subtask 3.6.2: Create AdminUserManagementView.tsx
- [ ] **Status:** Not Started
- **What:** User search table, detail modal, wallet adjust, block action
- **Effort:** ~200 lines

#### Subtask 3.6.3: Create AdminOrderManagementView.tsx
- [ ] **Status:** Not Started
- **What:** Order table with filters, detail modal, reassign rider
- **Effort:** ~250 lines

#### Subtask 3.6.4: Create AdminRiderManagementView.tsx
- [ ] **Status:** Not Started
- **What:** Rider approval queue, list, approve/reject actions
- **Effort:** ~200 lines

---

### Task 3.7: Update App Routing

**File:** `src/App.tsx`

#### Subtask 3.7.1: Add Admin Routing Logic
- [ ] **Status:** Not Started
- **Add admin view states and routing**

---

### Task 3.8: Testing & Verification

#### Subtask 3.8.1: Test All Admin Endpoints
- [ ] **Status:** Not Started

#### Subtask 3.8.2: Test Admin UI Flows
- [ ] **Status:** Not Started

---

## 📋 Summary Checklist

### Phase 1: Delivery Trip State Machine
- [ ] All 9 service methods implemented
- [ ] All 8 controller endpoints added
- [ ] autoAssignRider refactored to use Rider model
- [ ] Stale tracking updated to use lastPingAt
- [ ] API client updated
- [ ] Manual API testing complete
- [ ] Database verification passed
- [ ] WebSocket events verified

### Phase 2: Ticketing System
- [ ] Tickets module created
- [ ] Service methods implemented
- [ ] Controller endpoints added with RBAC
- [ ] Module registered in app
- [ ] API client updated
- [ ] Testing complete

### Phase 3: Admin Console
- [ ] Admin module backend created
- [ ] Dashboard, user, order management services
- [ ] Controller with RBAC guards
- [ ] Module registered
- [ ] API client updated
- [ ] 4 admin frontend views built
- [ ] App routing updated
- [ ] End-to-end testing complete

---

## ✅ Definition of Done

**MVP is launch-ready when:**

1. ✅ Customer can place multi-brand order
2. ✅ Payment completes successfully
3. ✅ Order fans out to kitchens
4. ✅ Rider auto-assigned
5. ✅ Rider can accept trip via API
6. ✅ Rider can confirm pickup (generates OTP)
7. ✅ Rider can verify OTP and complete delivery
8. ✅ Rider earnings tracked in database
9. ✅ Customer can create support ticket
10. ✅ Admin can view live dashboard
11. ✅ Admin can manage users (wallet, block)
12. ✅ Admin can manage orders (reassign rider)
13. ✅ Admin can approve riders from queue

---

## 📊 Progress Tracking

**Overall MVP Progress:** 0 / 3 Phases Complete

- [ ] Phase 1: Delivery Trip State Machine (0%)
- [ ] Phase 2: Ticketing System (0%)
- [ ] Phase 3: Admin Console (0%)

---

**Last Updated:** September 2, 2026  
**Next Update:** Mark tasks complete as you finish them!
