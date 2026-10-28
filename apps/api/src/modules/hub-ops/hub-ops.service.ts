import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderTrackingGateway } from '../websockets/websockets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';
import {
  getWalletRefundsByOrder,
  netCollectedPaise,
} from '../../common/utils/revenue';

@Injectable()
export class HubOpsService {
  private readonly logger = new Logger(HubOpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketsGateway: OrderTrackingGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Handoff email is informational. The trip is already committed, so a mail
   * failure is logged instead of failing the desk operation.
   */
  private async notifyOutForDelivery(orderId: string, userId: string) {
    try {
      const buyer = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!buyer?.email) return;

      await this.notifications.sendOrderStatusEmail(
        buyer.email,
        orderId,
        'OUT_FOR_DELIVERY',
        userId,
      );
    } catch (err: any) {
      this.logger.warn(
        `Order ${orderId} OUT_FOR_DELIVERY email failed: ${err?.message || 'unknown error'}`,
      );
    }
  }

  /**
   * Hub Manager Dashboard (§5.1)
   */
  async getHubDashboard(hubId: string) {
    const hub = await this.prisma.hub.findUnique({
      where: { id: hubId },
      include: {
        brandKitchens: {
          include: {
            brand: true,
          },
        },
      },
    });

    if (!hub) {
      throw new NotFoundException(`Hub '${hubId}' not found`);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      activeKdsOrders,
      todayOrders,
      stagedRiders,
      activeTrips,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          hubId,
          status: { in: ['PLACED', 'ACCEPTED_BY_KITCHEN', 'PREPARING'] },
        },
      }),
      this.prisma.order.count({
        where: {
          hubId,
          createdAt: { gte: todayStart },
        },
      }),
      this.prisma.rider.count({
        where: {
          currentHubId: hubId,
          isOnline: true,
          status: 'APPROVED',
        },
      }),
      this.prisma.deliveryTrip.count({
        where: {
          order: { hubId },
          status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING'] },
        },
      }),
    ]);

    return {
      hub: {
        id: hub.id,
        name: hub.name,
        city: hub.city,
        operatingHoursStart: hub.operatingHoursStart,
        operatingHoursEnd: hub.operatingHoursEnd,
        brandKitchensCount: hub.brandKitchens.length,
        brands: hub.brandKitchens.map((bk) => bk.brand.name),
      },
      metrics: {
        activeKdsOrders,
        todayOrders,
        stagedRiders,
        activeTrips,
      },
    };
  }

  /**
   * Hub Stock & 86 Management (§5.1)
   * Lists all menu items across all brand kitchens in this hub with availability
   */
  async getHubStock(hubId: string) {
    const brandKitchens = await this.prisma.brandKitchen.findMany({
      where: { hubId },
      include: {
        brand: true,
        menuItems: {
          orderBy: { name: 'asc' },
        },
      },
    });

    return brandKitchens.map((bk) => ({
      brandKitchenId: bk.id,
      brandId: bk.brandId,
      brandName: bk.brand.name,
      isOpen: bk.isOpen,
      menuItems: bk.menuItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        mrpInPaise: item.mrpInPaise,
        memberPriceInPaise: item.memberPriceInPaise,
        isAvailable: item.isAvailable,
        dietType: item.dietType,
        spiceLevel: item.spiceLevel,
      })),
    }));
  }

  /**
   * Bulk 86 Toggle (§5.1)
   * Toggle item availability (86'd) for items in this hub
   */
  async bulkToggle86(hubId: string, itemUpdates: { menuItemId: string; isAvailable: boolean }[]) {
    const results: { id: string; name: string; isAvailable: boolean }[] = [];

    for (const update of itemUpdates) {
      // Verify item belongs to this hub's brand kitchen
      const item = await this.prisma.menuItem.findFirst({
        where: {
          id: update.menuItemId,
          brandKitchen: { hubId },
        },
      });

      if (item) {
        const updated = await this.prisma.menuItem.update({
          where: { id: item.id },
          data: { isAvailable: update.isAvailable },
        });
        results.push({ id: updated.id, name: updated.name, isAvailable: updated.isAvailable });
      }
    }

    return results;
  }

  /**
   * Hub Staff Management (§5.1)
   */
  async getHubStaff(hubId: string) {
    return this.prisma.user.findMany({
      where: {
        scopedHubId: hubId,
        role: { in: ['HUB_STAFF', 'HUB_MANAGER'] },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  /**
   * Assign staff to hub (§5.1)
   */
  async assignStaff(
    hubId: string,
    userId: string,
    role: 'HUB_STAFF' | 'HUB_MANAGER',
    actor?: AuthenticatedActor,
  ) {
    const hub = await this.prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) throw new NotFoundException(`Hub ${hubId} not found`);

    if (role !== 'HUB_STAFF' && role !== 'HUB_MANAGER') {
      throw new BadRequestException('role must be HUB_STAFF or HUB_MANAGER');
    }

    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException(`User ${userId} not found`);

    // A hub manager must never be able to rewrite an admin/rider/brand account.
    // Previously this endpoint accepted any user id, so a hub manager could
    // demote the super admin to HUB_STAFF.
    if (['ADMIN', 'RIDER', 'BRAND_OPS'].includes(target.role)) {
      throw new ForbiddenException(
        'Admin, rider, and brand-ops accounts cannot be reassigned as hub staff',
      );
    }
    if (actor?.sub === target.id) {
      throw new ForbiddenException('You cannot change your own role');
    }

    // Only an admin can mint another hub manager, and a hub manager cannot
    // pull staff who already belong to a different hub.
    if (actor?.role === 'HUB_MANAGER') {
      if (role === 'HUB_MANAGER') {
        throw new ForbiddenException('Only an admin can assign a hub manager');
      }
      if (target.scopedHubId && target.scopedHubId !== hubId) {
        throw new ForbiddenException('This user already belongs to another hub');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role,
        scopedHubId: hubId,
        scopedBrandId: null,
        adminSubRole: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'HUB_STAFF_ASSIGNED',
        actorId: actor?.sub || 'SYSTEM',
        recordId: userId,
        diff: { hubId, role },
      },
    });

    return updated;
  }

  /**
   * Hub Finance (§5.1)
   */
  async getHubFinance(hubId: string) {
    const [orders, refunds] = await Promise.all([
      this.prisma.order.findMany({
        where: { hubId, status: { not: 'CANCELLED' } },
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          mrpTotalPaise: true,
          memberSavingsPaise: true,
          finalPaidPaise: true,
          walletAppliedPaise: true,
          createdAt: true,
          payment: {
            select: {
              status: true,
              amountInPaise: true,
              gateway: true,
              refundedAmountPaise: true,
            },
          },
        },
      }),
      getWalletRefundsByOrder(this.prisma),
    ]);

    // Hub finance must use the same "money actually collected" definition as
    // the platform revenue report. The old version summed finalPaidPaise for
    // orders that were still PREPARING (never paid), and ignored wallet/refunds.
    const byGateway = { RAZORPAY: 0, WALLET: 0 };
    let totalRevenuePaise = 0;
    let paidOrders = 0;

    for (const order of orders) {
      const { collectedPaise, gateway } = netCollectedPaise(
        order,
        refunds.get(order.id) ?? 0,
      );
      if (collectedPaise > 0) {
        totalRevenuePaise += collectedPaise;
        byGateway[gateway] += collectedPaise;
        paidOrders += 1;
      }
    }

    const avgOrderValuePaise = paidOrders > 0 ? Math.round(totalRevenuePaise / paidOrders) : 0;

    return {
      hubId,
      totalOrders: paidOrders,
      totalRevenuePaise,
      totalRevenueRupees: totalRevenuePaise / 100,
      avgOrderValuePaise,
      avgOrderValueRupees: avgOrderValuePaise / 100,
      byGateway,
    };
  }

  /**
   * Hub Riders (§5.1)
   * Lists riders currently staged at this hub
   */
  async getHubRiders(hubId: string) {
    return this.prisma.rider.findMany({
      where: {
        currentHubId: hubId,
      },
      include: {
        trips: {
          where: {
            status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING'] },
          },
          take: 1,
        },
      },
      orderBy: { isOnline: 'desc' },
    });
  }

  /**
   * Rider Handoff Desk (§5.1)
   * Hub staff confirms all multi-brand packets for a trip are handed to rider
   */
  async confirmRiderHandoff(hubId: string, tripId: string) {
    const trip = await this.prisma.deliveryTrip.findUnique({
      where: { id: tripId },
      include: {
        order: {
          include: {
            brandOrders: true,
          },
        },
        rider: true,
      },
    });

    if (!trip) {
      throw new NotFoundException(`DeliveryTrip '${tripId}' not found`);
    }

    if (trip.order.hubId !== hubId) {
      throw new BadRequestException(`Trip '${tripId}' does not originate from hub '${hubId}'`);
    }

    if (!trip.riderId) {
      throw new BadRequestException(
        `Trip '${tripId}' has no rider assigned yet. Dispatch a rider before handing off.`,
      );
    }

    // Verify all brand tickets are READY (rejected tickets need no packet)
    const pendingBrandOrders = trip.order.brandOrders.filter(
      (bo) => bo.status !== 'READY' && bo.status !== 'REJECTED',
    );
    if (pendingBrandOrders.length > 0) {
      throw new BadRequestException(
        `Cannot complete handoff: ${pendingBrandOrders.length} brand ticket(s) are not marked READY yet.`,
      );
    }

    // Idempotent: a second click must not regenerate the OTP or regress the trip.
    if (['PICKED_UP', 'ARRIVING', 'DELIVERED'].includes(trip.status)) {
      return {
        success: true,
        alreadyHandedOff: true,
        message: 'This trip has already been handed off.',
        tripId: trip.id,
        orderId: trip.orderId,
        rider: trip.rider?.name,
      };
    }

    if (!['ACCEPTED', 'ARRIVED_AT_HUB'].includes(trip.status)) {
      throw new BadRequestException(
        `Trip '${tripId}' cannot be handed off from status '${trip.status}'. The rider must accept and arrive at the hub first.`,
      );
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const updatedTrip = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryTrip.update({
        where: { id: tripId },
        data: { status: 'PICKED_UP', deliveryOtp: otp },
      });

      // Advance the parent order as well — the handoff desk previously left it
      // stuck while claiming success.
      await tx.order.update({
        where: { id: trip.orderId },
        data: { status: 'OUT_FOR_DELIVERY' },
      });

      return updated;
    });

    this.websocketsGateway.emitOrderStatusUpdate(trip.orderId, 'OUT_FOR_DELIVERY', {
      tripId,
      riderId: trip.riderId,
      status: 'PICKED_UP',
      // The order room also contains the rider, so the handover code is never
      // broadcast here. The customer reads it from their own order.
    });

    this.websocketsGateway.emitRiderPickedUp(trip.orderId, hubId, {
      tripId,
      riderId: trip.riderId,
      riderName: trip.rider?.name,
      orderId: trip.orderId,
    });

    this.logger.log(`📦 Handoff confirmed for trip ${tripId} (hub ${hubId})`);

    await this.notifyOutForDelivery(trip.orderId, trip.order.userId);

    return {
      success: true,
      message: 'All brand order packets successfully handed off to rider',
      tripId: updatedTrip.id,
      orderId: trip.orderId,
      rider: trip.rider?.name,
    };
  }

  /**
   * Hubs visible to the current operator.
   *
   *  - ADMIN sees every hub.
   *  - Hub staff only see the hub they are scoped to.
   *  - Brand ops only see hubs that actually run one of their kitchens, so the
   *    KDS cannot be used to inspect a competitor brand's tickets.
   */
  async listHubs(actor: AuthenticatedActor) {
    const role = actor?.role || 'CUSTOMER';

    if (role === 'ADMIN') {
      return this.prisma.hub.findMany({
        select: { id: true, name: true, city: true },
        orderBy: { name: 'asc' },
      });
    }

    if (role === 'HUB_STAFF' || role === 'HUB_MANAGER') {
      if (!actor.scopedHubId) return [];
      return this.prisma.hub.findMany({
        where: { id: actor.scopedHubId },
        select: { id: true, name: true, city: true },
      });
    }

    if (role === 'BRAND_OPS') {
      if (!actor.scopedBrandId) return [];
      return this.prisma.hub.findMany({
        where: { brandKitchens: { some: { brandId: actor.scopedBrandId } } },
        select: { id: true, name: true, city: true },
        orderBy: { name: 'asc' },
      });
    }

    return [];
  }

  /**
   * Live KDS ticket board for a hub.
   *
   * The kitchen screen needs real brand tickets, not local mock state. Only
   * settled orders are returned so the kitchen never cooks an unpaid order.
   */
  async getHubKdsTickets(hubId: string, actor?: AuthenticatedActor) {
    const hub = await this.prisma.hub.findUnique({ where: { id: hubId }, select: { id: true } });
    if (!hub) {
      throw new NotFoundException(`Hub '${hubId}' not found`);
    }

    // Brand ops must only ever see their own brand's tickets.
    const brandScope =
      actor?.role === 'BRAND_OPS' && actor.scopedBrandId
        ? { brandId: actor.scopedBrandId }
        : {};

    const tickets = await this.prisma.brandOrder.findMany({
      where: {
        ...brandScope,
        order: {
          hubId,
          status: { notIn: ['CANCELLED', 'DELIVERED'] },
          // Never send an unpaid order to the kitchen. Every payment method
          // now requires a successful payment row before cooking starts.
          payment: { status: 'SUCCESS' },
        },
        status: { in: ['SENT_TO_KITCHEN', 'ACCEPTED', 'PREPARING', 'READY'] },
      },
      include: {
        items: true,
        order: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            paymentMethod: true,
            payment: { select: { status: true } },
            deliveryTrip: { select: { id: true, status: true, riderId: true } },
          },
        },
      },
      orderBy: { order: { createdAt: 'asc' } },
    });

    // Attach brand names without an N+1 query.
    const brandIds = [...new Set(tickets.map((t) => t.brandId))];
    const brands = await this.prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, name: true },
    });
    const brandNameById = new Map(brands.map((b) => [b.id, b.name]));

    return tickets.map((ticket) => ({
      id: ticket.id,
      orderId: ticket.orderId,
      brandId: ticket.brandId,
      brandName: brandNameById.get(ticket.brandId) || ticket.brandId,
      status: ticket.status,
      rejectedAt: ticket.rejectedAt,
      rejectReason: ticket.rejectReason,
      items: ticket.items.map((item) => ({
        id: item.id,
        name: item.nameSnapshot,
        quantity: item.quantity,
        priceInPaise: item.priceSnapshot,
      })),
      order: {
        id: ticket.order.id,
        status: ticket.order.status,
        createdAt: ticket.order.createdAt,
        paymentMethod: ticket.order.paymentMethod,
        isSettled: ticket.order.payment?.status === 'SUCCESS',
        trip: ticket.order.deliveryTrip,
      },
    }));
  }
}
