import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderTrackingGateway } from '../websockets/websockets.gateway';
import { ReferralsService } from '../referrals/referrals.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketsGateway: OrderTrackingGateway,
    private readonly referralsService: ReferralsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Informational lifecycle email. Failures are logged, never thrown: a
   * delivery must not fail because an email provider is down.
   */
  private async notifyOrderStatus(
    orderId: string,
    userId: string,
    status: 'ACCEPTED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED',
  ) {
    try {
      const buyer = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!buyer?.email) return;

      await this.notifications.sendOrderStatusEmail(
        buyer.email,
        orderId,
        status,
        userId,
      );
    } catch (err: any) {
      this.logger.warn(
        `Order ${orderId} ${status} email failed: ${err?.message || 'unknown error'}`,
      );
    }
  }

  /**
   * A hub manager may only dispatch trips that belong to their own hub.
   * Admins have platform-wide access.
   */
  private assertHubScope(actor: AuthenticatedActor | undefined, hubId: string) {
    if (
      actor?.role === 'HUB_MANAGER' &&
      actor.scopedHubId &&
      actor.scopedHubId !== hubId
    ) {
      throw new ForbiddenException('This trip belongs to a different hub');
    }
  }

  async autoAssignRider(orderId: string, actor?: AuthenticatedActor) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        hub: true,
        brandOrders: true,
        deliveryTrip: true,
      },
    });
    if (!order) return null;

    this.assertHubScope(actor, order.hubId);

    // Gate Constraint: Ensure ALL non-rejected BrandOrders are ACCEPTED, PREPARING, or READY
    const validBrandOrders = order.brandOrders.filter((bo) => bo.status !== 'REJECTED');
    if (validBrandOrders.length === 0) {
      this.logger.warn(`⛔ Cannot assign rider for Order ${orderId}: All brand tickets were rejected.`);
      return null;
    }

    const allAccepted = validBrandOrders.every((bo) =>
      ['ACCEPTED', 'PREPARING', 'READY'].includes(bo.status),
    );

    if (!allAccepted) {
      this.logger.warn(
        `⏳ Rider Assignment Gated for Order ${orderId}: Waiting for all brand kitchens to accept tickets. (${validBrandOrders.filter((b) => b.status === 'SENT_TO_KITCHEN').length} pending)`,
      );
      return null;
    }

    const rider = await this.findAvailableRider(order.hubId);

    // An existing trip that already has a live rider is returned as-is.
    if (order.deliveryTrip && order.deliveryTrip.riderId && order.deliveryTrip.status !== 'UNASSIGNED') {
      return { trip: this.withoutDeliveryOtp(order.deliveryTrip) };
    }

    // An existing UNASSIGNED trip (e.g. after a rider rejection) is re-dispatched
    // instead of being left stranded with a null rider.
    if (order.deliveryTrip) {
      if (!rider) {
        this.logger.warn(`⚠️ Trip ${order.deliveryTrip.id} still has no available rider for Order ${orderId}`);
        return { trip: order.deliveryTrip };
      }

      const trip = await this.prisma.deliveryTrip.update({
        where: { id: order.deliveryTrip.id },
        data: { riderId: rider.id, status: 'ASSIGNED' },
      });

      this.websocketsGateway.emitTripOffered(rider.id, this.withoutDeliveryOtp(trip));
      this.logger.log(`🛵 Re-dispatched trip ${trip.id} for Order ${orderId} → Rider ${rider.id}`);
      return { trip: this.withoutDeliveryOtp(trip) };
    }

    const trip = await this.prisma.deliveryTrip.create({
      data: {
        orderId,
        riderId: rider ? rider.id : null,
        // A trip with no rider is UNASSIGNED, not ASSIGNED — otherwise every
        // rider-action button is hidden and the delivery dead-ends.
        status: rider ? 'ASSIGNED' : 'UNASSIGNED',
        pickupLat: order.hub.lat,
        pickupLng: order.hub.lng,
      },
    });

    this.logger.log(
      `🛵 Auto-assigned delivery trip ${trip.id} for Order ${order.id} (All ${validBrandOrders.length} brand tickets accepted)${rider ? ` → Rider: ${rider.id}` : ' → No available rider (will assign later)'}`,
    );

    if (rider) {
      this.websocketsGateway.emitTripOffered(rider.id, this.withoutDeliveryOtp(trip));
    }

    return {
      trip: this.withoutDeliveryOtp(trip),
    };
  }

  /**
   * Finds an online, approved rider who is not already on an active trip.
   * Prefers riders staged at the order's hub, then falls back to any online rider.
   */
  private async findAvailableRider(hubId: string, excludeRiderIds: string[] = []) {
    const busyTrips = await this.prisma.deliveryTrip.findMany({
      where: {
        status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING'] },
        riderId: { not: null },
      },
      select: { riderId: true },
    });

    const busyRiderIds = Array.from(
      new Set([
        ...busyTrips.map((t) => t.riderId as string),
        ...excludeRiderIds,
      ]),
    );

    const availabilityFilter = {
      status: 'APPROVED' as const,
      isOnline: true,
      ...(busyRiderIds.length > 0 ? { id: { notIn: busyRiderIds } } : {}),
    };

    return (
      (await this.prisma.rider.findFirst({
        where: { ...availabilityFilter, currentHubId: hubId },
      })) ??
      (await this.prisma.rider.findFirst({
        where: availabilityFilter,
      }))
    );
  }

  async getActiveTrips(actor?: AuthenticatedActor) {
    const trips = await this.prisma.deliveryTrip.findMany({
      where: {
        status: {
          in: ['UNASSIGNED', 'ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING'],
        },
        ...(actor?.role === 'HUB_MANAGER' && actor.scopedHubId
          ? { order: { hubId: actor.scopedHubId } }
          : {}),
      },
      include: {
        rider: {
          select: {
            id: true,
            name: true,
            phone: true,
            rating: true,
            isOnline: true,
            liveLat: true,
            liveLng: true,
          },
        },
        order: {
          include: {
            address: true,
            hub: true,
            user: { select: { id: true, name: true, phone: true } },
            brandOrders: {
              include: { items: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Hub managers run dispatch but never hand the food to the customer, so
    // they have no business seeing the handover code.
    return actor?.role === 'HUB_MANAGER'
      ? trips.map((trip) => this.withoutDeliveryOtp(trip))
      : trips;
  }

  /**
   * GPS Ping Ingestion Endpoint (SDD §7.5 & Task 11)
   * High-frequency location update from delivery partner app.
   * Updates live coordinates in DB and broadcasts `riderLocationUpdate` over WebSockets.
   */
  async updateRiderLocation(riderId: string, location: { lat: number; lng: number }) {
    const activeTrip = await this.prisma.deliveryTrip.findFirst({
      where: {
        riderId,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING'] },
      },
    });

    if (!activeTrip) {
      throw new NotFoundException(`No active delivery trip found for rider '${riderId}'`);
    }

    const updatedTrip = await this.prisma.deliveryTrip.update({
      where: { id: activeTrip.id },
      data: {
        liveLat: location.lat,
        liveLng: location.lng,
        lastPingAt: new Date(),
      },
    });

    // Update Rider model live coordinates per AddendumPlan Chunk 8
    await this.prisma.rider.update({
      where: { id: riderId },
      data: {
        liveLat: location.lat,
        liveLng: location.lng,
      },
    }).catch(() => null);

    // Real-time WebSocket broadcast to customer's order room
    this.websocketsGateway.emitRiderLocationUpdate(activeTrip.orderId, {
      lat: location.lat,
      lng: location.lng,
      riderId,
    });

    this.logger.log(
      `📡 [GPS Ingestion] Rider ${riderId} pinged (${location.lat}, ${location.lng}) → Broadcasted to order:${activeTrip.orderId}`,
    );

    return {
      success: true,
      tripId: updatedTrip.id,
      orderId: updatedTrip.orderId,
      liveLat: updatedTrip.liveLat,
      liveLng: updatedTrip.liveLng,
    };
  }

  /**
   * Helper: Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  /**
   * Rider accepts the assigned trip
   * ASSIGNED → ACCEPTED
   */
  async acceptTrip(tripId: string, riderId: string, actor?: AuthenticatedActor) {
    const trip = await this.prisma.deliveryTrip.findUnique({
      where: { id: tripId },
      include: { order: true },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    this.assertHubScope(actor, trip.order.hubId);

    if (trip.riderId !== riderId) {
      throw new ForbiddenException(`Trip ${tripId} is not assigned to rider ${riderId}`);
    }

    if (trip.status !== 'ASSIGNED') {
      throw new ConflictException(`Trip ${tripId} cannot be accepted from status ${trip.status}`);
    }

    const updatedTrip = await this.prisma.deliveryTrip.update({
      where: { id: tripId },
      data: { status: 'ACCEPTED' },
      include: { order: { include: { address: true } } },
    });

    this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, 'RIDER_ACCEPTED', {
      tripId,
      riderId,
      status: 'ACCEPTED',
    });

    // Emit tripAccepted to customer & admin:dashboard per Chunk 12
    this.websocketsGateway.emitTripAccepted(trip.orderId, {
      tripId,
      riderId,
      status: 'ACCEPTED',
      orderId: trip.orderId,
    });

    this.logger.log(`✅ Rider ${riderId} accepted trip ${tripId}`);

    return updatedTrip;
  }

  /**
   * Rider arrives at hub (with geofence validation)
   * ACCEPTED → ARRIVED_AT_HUB
   */
  async arrivedAtHub(
    tripId: string,
    riderId: string,
    lat: number,
    lng: number,
    actor?: AuthenticatedActor,
  ) {
    const trip = await this.prisma.deliveryTrip.findUnique({
      where: { id: tripId },
      include: { order: { include: { hub: true } } },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    this.assertHubScope(actor, trip.order.hubId);

    if (trip.riderId !== riderId) {
      throw new ForbiddenException(`Trip ${tripId} is not assigned to rider ${riderId}`);
    }

    if (trip.status !== 'ACCEPTED') {
      throw new ConflictException(`Trip ${tripId} cannot transition to ARRIVED_AT_HUB from status ${trip.status}`);
    }

    // Geofence validation: must be within 100m of hub
    const distance = this.calculateDistance(lat, lng, trip.order.hub.lat, trip.order.hub.lng);
    if (distance > 0.1) { // 100m = 0.1km
      throw new BadRequestException(`Rider is ${(distance * 1000).toFixed(0)}m away from hub. Must be within 100m to confirm arrival.`);
    }

    const updatedTrip = await this.prisma.deliveryTrip.update({
      where: { id: tripId },
      data: { status: 'ARRIVED_AT_HUB' },
      include: { order: { include: { address: true } } },
    });

    this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, 'RIDER_AT_HUB', {
      tripId,
      riderId,
      status: 'ARRIVED_AT_HUB',
    });

    // Emit riderArrivedAtHub to hub KDS room per Chunk 12
    this.websocketsGateway.emitRiderArrivedAtHub(trip.order.hubId, {
      tripId,
      riderId,
      orderId: trip.orderId,
    });

    this.logger.log(`📍 Rider ${riderId} arrived at hub for trip ${tripId}`);

    return updatedTrip;
  }

  /**
   * Rider confirms pickup from hub (generates OTP for delivery)
   * ARRIVED_AT_HUB → PICKED_UP
   */
  async confirmPickup(tripId: string, riderId: string, actor?: AuthenticatedActor) {
    const trip = await this.prisma.deliveryTrip.findUnique({
      where: { id: tripId },
      include: { order: true },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    this.assertHubScope(actor, trip.order.hubId);

    if (trip.riderId !== riderId) {
      throw new ForbiddenException(`Trip ${tripId} is not assigned to rider ${riderId}`);
    }

    if (trip.status !== 'ARRIVED_AT_HUB') {
      throw new ConflictException(
        `Trip ${tripId} cannot transition to PICKED_UP from status ${trip.status}`,
      );
    }

    // The rider must not leave the hub until every live kitchen ticket is
    // packed. The hub handoff desk enforces this; the dispatch shortcut has to
    // enforce it too or the rider delivers a half-finished order.
    const pendingTickets = await this.prisma.brandOrder.count({
      where: {
        orderId: trip.orderId,
        status: { notIn: ['READY', 'REJECTED'] },
      },
    });
    if (pendingTickets > 0) {
      throw new ConflictException(
        `Cannot hand off yet: ${pendingTickets} kitchen ticket(s) are still being prepared.`,
      );
    }

    // Generate 4-digit OTP for delivery verification
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const updatedTrip = await this.prisma.$transaction(async (tx) => {
      const pickedUpTrip = await tx.deliveryTrip.update({
        where: { id: tripId },
        data: {
          status: 'PICKED_UP',
          deliveryOtp: otp,
        },
        include: { order: { include: { address: true } } },
      });

      await tx.order.update({
        where: { id: trip.orderId },
        data: { status: 'OUT_FOR_DELIVERY' },
      });

      return pickedUpTrip;
    });

    this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, 'OUT_FOR_DELIVERY', {
      tripId,
      riderId,
      status: 'PICKED_UP',
      // Deliberately no OTP: the order room also contains the rider and hub
      // staff. The customer app re-reads /orders/:id, which returns the code to
      // the buyer only.
    });

    // Emit riderPickedUp to customer & hub KDS room per Chunk 12
    const hubId = (await this.prisma.order.findUnique({ where: { id: trip.orderId }, select: { hubId: true } }))?.hubId || '';
    this.websocketsGateway.emitRiderPickedUp(trip.orderId, hubId, {
      tripId,
      riderId,
      orderId: trip.orderId,
    });

    this.logger.log(`📦 Rider ${riderId} picked up order for trip ${tripId}`);

    await this.notifyOrderStatus(
      trip.orderId,
      trip.order.userId,
      'OUT_FOR_DELIVERY',
    );

    return { trip: this.withoutDeliveryOtp(updatedTrip) };
  }

  /**
   * Rider arrives at customer location (with geofence validation)
   * PICKED_UP → ARRIVING
   */
  async arrivedAtCustomer(tripId: string, riderId: string, actor?: AuthenticatedActor) {
    const trip = await this.prisma.deliveryTrip.findUnique({
      where: { id: tripId },
      include: { order: { include: { address: true } } },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    this.assertHubScope(actor, trip.order.hubId);

    if (trip.riderId !== riderId) {
      throw new ForbiddenException(`Trip ${tripId} is not assigned to rider ${riderId}`);
    }

    if (trip.status !== 'PICKED_UP') {
      throw new ConflictException(`Trip ${tripId} cannot transition to ARRIVING from status ${trip.status}`);
    }

    const updatedTrip = await this.prisma.deliveryTrip.update({
      where: { id: tripId },
      data: { status: 'ARRIVING' },
      include: { order: { include: { address: true } } },
    });

    this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, 'RIDER_ARRIVING', {
      tripId,
      riderId,
      status: 'ARRIVING',
    });

    this.logger.log(`🏠 Rider ${riderId} arriving at customer for trip ${tripId}`);

    return updatedTrip;
  }

  /**
   * Verify delivery OTP and complete delivery (creates rider earnings)
   * ARRIVING → DELIVERED
   */
  async verifyDeliveryOtp(
    tripId: string,
    riderId: string,
    otp: string,
    proofPhotoUrl?: string,
    actor?: AuthenticatedActor,
  ) {
    const trip = await this.prisma.deliveryTrip.findUnique({
      where: { id: tripId },
      include: { order: { include: { address: true, hub: true } } },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    this.assertHubScope(actor, trip.order.hubId);

    if (trip.riderId !== riderId) {
      throw new ForbiddenException(`Trip ${tripId} is not assigned to rider ${riderId}`);
    }

    if (trip.status !== 'ARRIVING') {
      throw new ConflictException(`Trip ${tripId} cannot be delivered from status ${trip.status}`);
    }

    if (trip.deliveryOtp !== otp) {
      throw new BadRequestException(`Invalid delivery OTP for trip ${tripId}`);
    }

    // Calculate distance for earnings
    const distanceKm = this.calculateDistance(
      trip.order.hub.lat,
      trip.order.hub.lng,
      trip.order.address.lat,
      trip.order.address.lng,
    );

    // Delivery completion, the parent order status, and the rider's earnings
    // must land together: a delivered trip with no earnings silently underpays
    // the rider, and a failed delivery must not leave the order marked done.
    const baseFee = 3000; // ₹30 base
    const distanceFee = Math.floor(distanceKm * 800); // ₹8/km

    const updatedTrip = await this.prisma.$transaction(async (tx) => {
      // The status check above happens before the transaction. Lock the trip so
      // two concurrent OTP submissions cannot both pay rider earnings.
      await tx.$executeRaw`SELECT "id" FROM "delivery_trips" WHERE "id" = ${tripId} FOR UPDATE`;
      const freshTrip = await tx.deliveryTrip.findUnique({
        where: { id: tripId },
        select: { status: true },
      });
      if (!freshTrip || freshTrip.status !== 'ARRIVING') {
        throw new ConflictException(
          `Trip ${tripId} cannot be delivered from status ${freshTrip?.status ?? 'missing'}`,
        );
      }

      await tx.order.update({
        where: { id: trip.orderId },
        data: { status: 'DELIVERED' },
      });

      const deliveredTrip = await tx.deliveryTrip.update({
        where: { id: tripId },
        data: {
          status: 'DELIVERED',
          otpVerifiedAt: new Date(),
          proofPhotoUrl,
        },
        include: { order: { include: { address: true } } },
      });

      await tx.riderEarning.createMany({
        data: [
          {
            riderId,
            tripId,
            type: 'BASE_FEE',
            amountInPaise: baseFee,
          },
          {
            riderId,
            tripId,
            type: 'DISTANCE_FEE',
            amountInPaise: distanceFee,
          },
        ],
      });

      // A referral is only worth money once the invited customer's first order
      // is actually delivered. This runs in the same transaction as delivery,
      // so a rolled-back delivery cannot pay anybody.
      await this.referralsService.qualifyReferral(
        tx,
        trip.order.userId,
        trip.orderId,
      );

      return deliveredTrip;
    });

    this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, 'DELIVERED', {
      tripId,
      riderId,
      status: 'DELIVERED',
      earnings: { baseFee, distanceFee, total: baseFee + distanceFee },
    });

    // Emit deliveryVerified to customer & admin:dashboard per Chunk 12
    this.websocketsGateway.emitDeliveryVerified(trip.orderId, {
      tripId,
      riderId,
      orderId: trip.orderId,
      deliveredAt: updatedTrip.otpVerifiedAt,
      earnings: { baseFee, distanceFee, total: baseFee + distanceFee },
    });

    this.logger.log(
      `✅ Trip ${tripId} delivered by rider ${riderId}. Earnings: ₹${(baseFee + distanceFee) / 100}`,
    );

    await this.notifyOrderStatus(trip.orderId, trip.order.userId, 'DELIVERED');

    return updatedTrip;
  }

  /**
   * Rider rejects the assigned trip
   * ASSIGNED → UNASSIGNED (makes trip available for reassignment)
   */
  async rejectTrip(
    tripId: string,
    riderId: string,
    reason: string,
    actor?: AuthenticatedActor,
  ) {
    const trip = await this.prisma.deliveryTrip.findUnique({
      where: { id: tripId },
      include: { order: true },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    this.assertHubScope(actor, trip.order.hubId);

    if (trip.riderId !== riderId) {
      throw new ForbiddenException(`Trip ${tripId} is not assigned to rider ${riderId}`);
    }

    if (trip.status !== 'ASSIGNED') {
      throw new ConflictException(`Trip ${tripId} cannot be rejected from status ${trip.status}`);
    }

    // Release the trip, then immediately try to hand it to another rider.
    // Leaving it UNASSIGNED with no re-dispatch is how deliveries used to dead-end.
    const releasedTrip = await this.prisma.deliveryTrip.update({
      where: { id: tripId },
      data: {
        status: 'UNASSIGNED',
        riderId: null,
      },
      include: { order: { include: { address: true } } },
    });

    this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, 'RIDER_REJECTED', {
      tripId,
      riderId,
      reason,
      status: 'UNASSIGNED',
    });

    this.logger.warn(`❌ Rider ${riderId} rejected trip ${tripId}: ${reason}`);

    const replacement = await this.findAvailableRider(trip.order.hubId, [riderId]);
    if (!replacement) {
      this.logger.warn(`⚠️ No replacement rider available for trip ${tripId}; left UNASSIGNED for manual dispatch.`);
      return releasedTrip;
    }

    const reassignedTrip = await this.prisma.deliveryTrip.update({
      where: { id: tripId },
      data: { riderId: replacement.id, status: 'ASSIGNED' },
      include: { order: { include: { address: true } } },
    });

    this.websocketsGateway.emitTripOffered(replacement.id, reassignedTrip);
    this.logger.log(`🛵 Trip ${tripId} re-dispatched to rider ${replacement.id} after rejection.`);

    return reassignedTrip;
  }

  /**
   * Cancel trip (admin action or system timeout)
   * Any active status → CANCELLED
   */
  async cancelTrip(tripId: string, reason: string, actor?: AuthenticatedActor) {
    const trip = await this.prisma.deliveryTrip.findUnique({
      where: { id: tripId },
      include: { order: true },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    this.assertHubScope(actor, trip.order.hubId);

    if (['DELIVERED', 'CANCELLED'].includes(trip.status)) {
      throw new ConflictException(`Trip ${tripId} is already in terminal status ${trip.status}`);
    }

    const updatedTrip = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.deliveryTrip.update({
        where: { id: tripId },
        data: { status: 'CANCELLED' },
        include: { order: { include: { address: true } } },
      });

      // Cancelling the trip must cancel the parent order too, otherwise the
      // order stays active forever with no delivery attached.
      if (cancelled.order.status !== 'DELIVERED' && cancelled.order.status !== 'CANCELLED') {
        await tx.order.update({
          where: { id: cancelled.orderId },
          data: { status: 'CANCELLED' },
        });
      }

      return cancelled;
    });

    this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, 'CANCELLED', {
      tripId,
      reason,
      status: 'CANCELLED',
    });

    this.logger.warn(`🚫 Trip ${tripId} cancelled and order ${trip.orderId} cancelled: ${reason}`);

    return updatedTrip;
  }

  /**
   * Get rider's active trip
   */
  async getRiderActiveTrip(riderId: string) {
    const trip = await this.prisma.deliveryTrip.findFirst({
      where: {
        riderId,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING'] },
      },
      include: {
        order: {
          include: {
            address: true,
            hub: true,
            user: { select: { name: true, phone: true } },
            brandOrders: {
              include: { items: true },
            },
          },
        },
      },
    });

    // The rider must collect the code from the customer at the door. Shipping
    // it in the trip payload would let them self-complete the delivery.
    return trip ? this.withoutDeliveryOtp(trip) : null;
  }

  /**
   * Get rider's trip history
   */
  async getRiderTripHistory(riderId: string) {
    const trips = await this.prisma.deliveryTrip.findMany({
      where: { riderId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        order: {
          include: {
            address: true,
            hub: true,
          },
        },
      },
    });

    return trips.map((trip) => this.withoutDeliveryOtp(trip));
  }

  /** Remove the customer handover code from a trip before it leaves the API. */
  private withoutDeliveryOtp<T extends { deliveryOtp?: string | null }>(trip: T): Omit<T, 'deliveryOtp'> {
    const { deliveryOtp, ...safe } = trip;
    return safe;
  }
}
