import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { Queue } from 'bullmq';
import { KITCHEN_QUEUE } from '../queue/queue.constants';
import { LogisticsService } from '../logistics/logistics.service';
import { OrderTrackingGateway } from '../websockets/websockets.gateway';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

export type { AuthenticatedActor };

export type PaymentMethod = 'UPI' | 'CARD' | 'WALLET' | 'COD';

export interface CreateOrderDto {
  /** Ignored — the authenticated principal is always the order owner. */
  userId?: string;
  hubId?: string;
  addressId: string;
  couponCode?: string;
  useWalletBalance?: number;
  paymentMethod?: PaymentMethod;
  items: {
    menuItemId: string;
    quantity: number;
    /** Legacy client-supplied fields — accepted for compatibility but never trusted for money. */
    brandId?: string;
    nameSnapshot?: string;
    mrp?: number;
    price?: number;
  }[];
}

type BrandTicketStatus = 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED';

/** Allowed kitchen ticket transitions. Anything not listed here is rejected. */
const TICKET_TRANSITIONS: Record<string, BrandTicketStatus[]> = {
  SENT_TO_KITCHEN: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['PREPARING', 'REJECTED'],
  PREPARING: ['READY', 'REJECTED'],
  READY: [],
  REJECTED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly logisticsService: LogisticsService,
    private readonly websocketsGateway: OrderTrackingGateway,
    @Inject(KITCHEN_QUEUE) private readonly kitchenQueue: Queue,
  ) {}

  // ---------------------------------------------------------------------------
  // Order creation
  // ---------------------------------------------------------------------------

  async createOrder(
    dto: CreateOrderDto,
    actor: AuthenticatedActor,
    idempotencyKey?: string,
  ) {
    const userId = actor?.sub;
    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    // A retried checkout (double tap, flaky network) must return the original
    // order instead of charging the wallet and creating a second kitchen
    // ticket. The key is scoped to the user so one customer cannot probe
    // another customer's order ids.
    const retryKey = String(idempotencyKey || '').trim().slice(0, 128) || null;
    if (retryKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: retryKey },
        include: {
          brandOrders: { include: { items: true } },
          address: true,
          hub: true,
          payment: true,
        },
      });
      if (existing) {
        if (existing.userId !== userId) {
          throw new ForbiddenException('This idempotency key belongs to another account');
        }
        return existing;
      }
    }

    if (!dto?.items?.length) {
      throw new BadRequestException('Cart is empty');
    }
    if (!dto.addressId) {
      throw new BadRequestException('A delivery address is required');
    }

    // Normalise quantities. Duplicate lines for the same item are merged so a
    // client cannot bypass per-item limits by repeating a line.
    const requestedQty = new Map<string, number>();
    for (const line of dto.items) {
      if (!line?.menuItemId) {
        throw new BadRequestException('Every cart line needs a menuItemId');
      }
      const qty = Number(line.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new BadRequestException('Quantity must be a positive whole number');
      }
      if (qty > 50) {
        throw new BadRequestException('Quantity per item cannot exceed 50');
      }
      requestedQty.set(line.menuItemId, (requestedQty.get(line.menuItemId) || 0) + qty);
    }

    // The delivery address must belong to the caller.
    const address = await this.prisma.address.findUnique({ where: { id: dto.addressId } });
    if (!address) {
      throw new NotFoundException('Delivery address not found');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('This delivery address does not belong to you');
    }

    const hubId = dto.hubId || address.resolvedHubId;
    if (!hubId) {
      throw new BadRequestException('Could not resolve a delivery hub for this address');
    }

    const hub = await this.prisma.hub.findUnique({ where: { id: hubId }, select: { id: true } });
    if (!hub) {
      throw new BadRequestException('The selected hub does not exist');
    }

    // -------------------------------------------------------------------------
    // Server-authoritative pricing: every rupee comes from the database.
    // The client's `mrp` / `price` / `nameSnapshot` / `brandId` are ignored.
    // -------------------------------------------------------------------------
    const menuItemIds = [...requestedQty.keys()];
    const dbItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: { brandKitchen: true },
    });

    const lines = menuItemIds.map((menuItemId) => {
      const dbItem = dbItems.find((i) => i.id === menuItemId);
      if (!dbItem) {
        throw new BadRequestException('A cart item is no longer on the menu. Please refresh your cart.');
      }
      if (!dbItem.isAvailable) {
        throw new ConflictException(`'${dbItem.name}' is currently out of stock (86'd).`);
      }
      if (!dbItem.brandKitchen) {
        throw new BadRequestException(`'${dbItem.name}' is not attached to a kitchen.`);
      }
      if (dbItem.brandKitchen.hubId !== hubId) {
        throw new BadRequestException(
          `Cross-Hub Conflict: '${dbItem.name}' is not served from the selected hub.`,
        );
      }

      return {
        menuItemId: dbItem.id,
        brandId: dbItem.brandKitchen.brandId,
        nameSnapshot: dbItem.name,
        mrpInPaise: dbItem.mrpInPaise,
        // Defensive: a bad catalogue row must never make the member price exceed MRP.
        memberPriceInPaise: Math.min(dbItem.memberPriceInPaise, dbItem.mrpInPaise),
        quantity: requestedQty.get(menuItemId)!,
      };
    });

    // Edge Case 9A (SDD §5.2 & §7.3): validate the offer window at checkout time.
    const activeOffers = await this.pricingService.getActiveOffers();
    const hasHappyHourCoupon = dto.couponCode && /HAPPY/i.test(dto.couponCode);
    if (hasHappyHourCoupon && !activeOffers.isHappyHour) {
      throw new ConflictException(
        "Offer Expired: The 'Happy Hours' promotional discount has expired. Your cart prices have been re-evaluated to standard rates.",
      );
    }

    const priceBreakdown = await this.pricingService.calculateCartPrice({
      userId,
      items: lines.map((l) => ({
        price: l.mrpInPaise / 100,
        memberPrice: l.memberPriceInPaise / 100,
        quantity: l.quantity,
      })),
      couponCode: dto.couponCode,
      useWalletBalance: Math.max(0, Number(dto.useWalletBalance) || 0),
    });

    // A coupon the customer saw in the cart must actually be honoured. Silently
    // charging full price is a money-correctness bug, so reject instead.
    if (dto.couponCode && priceBreakdown.couponInvalid) {
      throw new BadRequestException(
        `Coupon '${dto.couponCode}' is not valid for this cart. Remove it and try again.`,
      );
    }

    const isMember = priceBreakdown.isMemberVerified;
    const mrpTotalPaise = Math.round(priceBreakdown.itemTotal * 100);
    const memberSavingsPaise = Math.round(priceBreakdown.memberDiscount * 100);
    const deliveryFeePaise = Math.round(priceBreakdown.deliveryFee * 100);
    const packagingFeePaise = Math.round(priceBreakdown.packagingFee * 100);
    const taxPaise = Math.round(priceBreakdown.taxes * 100);
    const walletAppliedPaise = Math.round(priceBreakdown.walletApplied * 100);
    const finalPaidPaise = Math.round(priceBreakdown.finalPayable * 100);

    const paymentMethod: PaymentMethod = dto.paymentMethod || 'UPI';
    if (paymentMethod === 'WALLET' && finalPaidPaise > 0) {
      throw new ConflictException(
        'Your wallet balance does not cover this order. Choose another payment method or remove items.',
      );
    }

    // Group by the *database* brand id — never the one supplied by the client.
    const itemsByBrand = new Map<string, typeof lines>();
    for (const line of lines) {
      const existing = itemsByBrand.get(line.brandId) || [];
      existing.push(line);
      itemsByBrand.set(line.brandId, existing);
    }

    this.logger.log(
      `🚀 Creating order across ${itemsByBrand.size} brand kitchen ticket(s). Payable: ₹${
        priceBreakdown.finalPayable
      } (wallet ₹${priceBreakdown.walletApplied})`,
    );

    let createdOrder: any;
    try {
      createdOrder = await this.prisma.$transaction(async (tx) => {
      // Re-validate availability inside the transaction — an item can be 86'd
      // between the pricing read above and the write below.
      const freshItems = await tx.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        select: { id: true, isAvailable: true },
      });
      for (const line of lines) {
        const fresh = freshItems.find((i) => i.id === line.menuItemId);
        if (!fresh || !fresh.isAvailable) {
          throw new ConflictException(`'${line.nameSnapshot}' is currently out of stock (86'd).`);
        }
      }

      const parentOrder = await tx.order.create({
        data: {
          userId,
          hubId,
          addressId: dto.addressId,
          idempotencyKey: retryKey,
          mrpTotalPaise,
          memberSavingsPaise,
          deliveryFeePaise,
          packagingFeePaise,
          taxPaise,
          walletAppliedPaise,
          finalPaidPaise,
          paymentMethod,
          discountBreakdown: priceBreakdown.savingsSummary,
          status: 'PLACED',
        },
      });

      for (const [brandId, brandLines] of itemsByBrand.entries()) {
        await tx.brandOrder.create({
          data: {
            orderId: parentOrder.id,
            brandId,
            status: 'SENT_TO_KITCHEN',
            items: {
              create: brandLines.map((l) => ({
                menuItemId: l.menuItemId,
                nameSnapshot: l.nameSnapshot,
                mrpSnapshot: l.mrpInPaise,
                priceSnapshot: isMember ? l.memberPriceInPaise : l.mrpInPaise,
                quantity: l.quantity,
              })),
            },
          },
        });
      }

      // Wallet money is only moved when it is actually being spent now:
      //  - WALLET: the order is settled immediately.
      //  - COD:    the wallet portion is settled up front, cash covers the rest.
      //  - UPI/CARD: debited on verified payment success (see PaymentsService),
      //    so abandoning the Razorpay modal no longer silently burns wallet credit.
      // If wallet credit covers the entire bill there is nothing left for a
      // gateway to charge, so settle it from the wallet even when the customer
      // picked UPI/CARD. Otherwise the order would never become paid.
      const walletCoversAll = walletAppliedPaise > 0 && finalPaidPaise === 0;
      const isFreeOrder = walletAppliedPaise === 0 && finalPaidPaise === 0;

      if (paymentMethod === 'WALLET' || paymentMethod === 'COD' || walletCoversAll) {
        await this.debitWallet(tx, userId, walletAppliedPaise, parentOrder.id);

        if (paymentMethod === 'WALLET' || walletCoversAll) {
          await tx.payment.create({
            data: {
              orderId: parentOrder.id,
              gateway: 'wallet',
              status: 'SUCCESS',
              amountInPaise: walletAppliedPaise,
            },
          });
        }
      }

      // A ₹0 order (100% coupon) still needs a settled payment row so the
      // kitchen payment gate does not block it forever.
      if (isFreeOrder && !['WALLET', 'COD'].includes(paymentMethod)) {
        await tx.payment.create({
          data: {
            orderId: parentOrder.id,
            gateway: 'wallet',
            status: 'SUCCESS',
            amountInPaise: 0,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'ORDER_CREATED',
          actorId: userId,
          recordId: parentOrder.id,
          diff: {
            finalPaidPaise,
            mrpTotalPaise,
            memberSavingsPaise,
            walletAppliedPaise,
            paymentMethod,
            brandCount: itemsByBrand.size,
          },
        },
      });

      return tx.order.findUnique({
        where: { id: parentOrder.id },
        include: {
          brandOrders: { include: { items: true } },
          address: true,
          hub: true,
          payment: true,
        },
      });
      });
    } catch (error: any) {
      // Two concurrent retries can both miss the pre-check; the unique index
      // makes one transaction lose with P2002. Return the winner instead of
      // surfacing a 500 to the customer.
      if (error?.code === 'P2002' && retryKey) {
        const winner = await this.prisma.order.findUnique({
          where: { idempotencyKey: retryKey },
          include: {
            brandOrders: { include: { items: true } },
            address: true,
            hub: true,
            payment: true,
          },
        });
        if (winner && winner.userId === userId) return winner;
      }
      throw error;
    }

    // Post-transaction: referral bonus on the user's first-ever order.
    if (createdOrder) {
      try {
        const [orderCount, userRecord] = await Promise.all([
          this.prisma.order.count({ where: { userId } }),
          this.prisma.user.findUnique({ where: { id: userId }, select: { referredById: true } }),
        ]);

        if (orderCount === 1 && userRecord?.referredById) {
          const referrerId = userRecord.referredById;
          const REFERRAL_BONUS_PAISE = 10000; // ₹100

          await this.prisma.$transaction(async (bonusTx) => {
            await bonusTx.user.update({
              where: { id: referrerId },
              data: { walletBalance: { increment: REFERRAL_BONUS_PAISE } },
            });
            await bonusTx.walletTransaction.create({
              data: {
                userId: referrerId,
                amountInPaise: REFERRAL_BONUS_PAISE,
                reason: 'REFERRAL_BONUS',
                orderId: createdOrder.id,
              },
            });
          });

          this.logger.log(
            `🎁 Referral bonus ₹100 credited to ${referrerId} for ${userId}'s first order ${createdOrder.id}`,
          );
        }
      } catch (refErr: any) {
        this.logger.warn(`Referral bonus trigger failed for order ${createdOrder?.id}: ${refErr.message}`);
      }
    }

    // Post-transaction: enqueue kitchen jobs.
    if (createdOrder?.brandOrders) {
      for (const brandOrder of createdOrder.brandOrders) {
        try {
          await this.kitchenQueue.add('brand_order.created', {
            hubId,
            orderId: createdOrder.id,
            brandOrder,
          });
        } catch (queueErr: any) {
          this.logger.warn(`Failed to enqueue BullMQ job: ${queueErr.message}`);
        }
      }
    }

    return createdOrder;
  }

  /**
   * Debits the wallet under a row lock. Caller must already be inside a transaction.
   */
  private async debitWallet(
    tx: Prisma.TransactionClient,
    userId: string,
    amountPaise: number,
    orderId: string,
  ) {
    if (amountPaise <= 0) return;

    await tx.$executeRaw`SELECT "walletBalance" FROM "users" WHERE id = ${userId} FOR UPDATE`;

    const lockedUser = await tx.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });

    if (!lockedUser || lockedUser.walletBalance < amountPaise) {
      throw new ConflictException(
        `Insufficient wallet balance: you have ₹${Math.round(
          (lockedUser?.walletBalance ?? 0) / 100,
        )} but this order needs ₹${Math.round(amountPaise / 100)}.`,
      );
    }

    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { decrement: amountPaise } },
    });

    await tx.walletTransaction.create({
      data: {
        userId,
        amountInPaise: -amountPaise,
        reason: 'ORDER_SPEND',
        orderId,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Cancellation
  // ---------------------------------------------------------------------------

  /**
   * Cancels an order that has not been paid and has not entered the kitchen.
   *
   * Checkout calls this when the customer dismisses the Razorpay modal or the
   * payment fails, so an abandoned attempt does not leave a live, unpaid order
   * sitting in the dispatch queue. Paid orders are deliberately rejected here:
   * they need the refund flow, not a silent cancellation.
   */
  async cancelUnpaidOrder(orderId: string, actor: AuthenticatedActor, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, brandOrders: true, deliveryTrip: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (actor?.role !== 'ADMIN' && order.userId !== actor?.sub) {
      throw new ForbiddenException('You can only cancel your own orders');
    }

    if (order.status === 'CANCELLED') {
      return order;
    }

    if (order.payment?.status === 'SUCCESS') {
      throw new ConflictException(
        'This order is already paid. Contact support for a refund instead of cancelling.',
      );
    }

    const kitchenStarted = order.brandOrders.some((ticket) =>
      ['ACCEPTED', 'PREPARING', 'READY'].includes(ticket.status),
    );
    if (kitchenStarted) {
      throw new ConflictException('The kitchen has already started this order.');
    }

    if (
      order.deliveryTrip &&
      !['UNASSIGNED', 'CANCELLED'].includes(order.deliveryTrip.status)
    ) {
      throw new ConflictException('A rider is already handling this order.');
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      // If wallet money was debited at creation (COD), put it back. For UPI /
      // CARD the wallet is only debited on verified payment success, so there
      // is nothing to refund here.
      const walletSpend = await tx.walletTransaction.findFirst({
        where: { orderId, reason: 'ORDER_SPEND' },
      });

      if (walletSpend && order.walletAppliedPaise > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { walletBalance: { increment: order.walletAppliedPaise } },
        });

        await tx.walletTransaction.create({
          data: {
            userId: order.userId,
            amountInPaise: order.walletAppliedPaise,
            reason: 'ORDER_REFUND',
            orderId,
          },
        });
      }

      await tx.brandOrder.updateMany({
        where: {
          orderId,
          status: { in: ['SENT_TO_KITCHEN', 'ACCEPTED', 'PREPARING', 'READY'] },
        },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectReason: reason || 'Cancelled before preparation',
        },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { orderId },
          data: { status: 'FAILED' },
        });
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          finalPaidPaise: 0,
          walletAppliedPaise: 0,
        },
        include: {
          brandOrders: { include: { items: true } },
          address: true,
          hub: true,
          payment: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ORDER_CANCELLED_UNPAID',
          actorId: actor?.sub,
          recordId: orderId,
          diff: {
            reason: reason || 'Customer abandoned payment',
            refundedWalletPaise: walletSpend ? order.walletAppliedPaise : 0,
          },
        },
      });

      return updated;
    });

    this.websocketsGateway.emitOrderStatusUpdate(orderId, 'CANCELLED', {
      orderId,
      status: 'CANCELLED',
      reason: reason || 'Cancelled before payment',
    });

    return cancelled;
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async getOrderById(orderId: string, actor: AuthenticatedActor) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        brandOrders: { include: { items: true } },
        address: true,
        hub: true,
        payment: true,
        deliveryTrip: {
          include: {
            rider: {
              select: {
                id: true,
                name: true,
                phone: true,
                rating: true,
                liveLat: true,
                liveLng: true,
                vehicleType: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    this.assertCanViewOrder(order, actor);
    return this.redactDeliveryOtp(order, actor);
  }

  /**
   * The delivery OTP is the customer's proof that the food reached their door.
   *
   * Riders, hub staff, and brand operators can all read an order they are
   * involved in, but none of them may receive the OTP: a rider holding the code
   * could close a delivery without ever meeting the customer. Only the buyer
   * (and a platform admin handling a dispute) sees it.
   */
  private redactDeliveryOtp<
    T extends { userId: string; deliveryTrip?: { deliveryOtp?: string | null } | null },
  >(order: T, actor: AuthenticatedActor): T {
    if (!order?.deliveryTrip) return order;

    const role = actor?.role || 'CUSTOMER';
    const isBuyer = order.userId === actor?.sub;
    if (role === 'ADMIN' || isBuyer) return order;

    return {
      ...order,
      deliveryTrip: { ...order.deliveryTrip, deliveryOtp: null },
    };
  }

  async getUserOrders(userId: string, actor: AuthenticatedActor) {
    if (actor?.role !== 'ADMIN' && actor?.sub !== userId) {
      throw new ForbiddenException('You can only view your own orders');
    }

    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        brandOrders: { include: { items: true } },
        address: true,
        hub: true,
        payment: true,
        deliveryTrip: {
          include: {
            rider: {
              select: {
                id: true,
                name: true,
                phone: true,
                rating: true,
                liveLat: true,
                liveLng: true,
                vehicleType: true,
              },
            },
          },
        },
      },
    });
  }

  private assertCanViewOrder(
    order: {
      userId: string;
      hubId: string;
      brandOrders: { brandId: string }[];
      deliveryTrip?: { riderId: string | null } | null;
    },
    actor: AuthenticatedActor,
  ) {
    const role = actor?.role || 'CUSTOMER';

    if (role === 'ADMIN') return;
    if (order.userId === actor.sub) return;

    if (role === 'RIDER' && order.deliveryTrip?.riderId === actor.sub) return;

    if (
      (role === 'HUB_STAFF' || role === 'HUB_MANAGER') &&
      actor.scopedHubId &&
      order.hubId === actor.scopedHubId
    ) {
      return;
    }

    if (
      role === 'BRAND_OPS' &&
      actor.scopedBrandId &&
      order.brandOrders.some((bo) => bo.brandId === actor.scopedBrandId)
    ) {
      return;
    }

    throw new ForbiddenException('You do not have access to this order');
  }

  // ---------------------------------------------------------------------------
  // Kitchen ticket state machine
  // ---------------------------------------------------------------------------

  async updateBrandOrderStatus(
    brandOrderId: string,
    status: BrandTicketStatus,
    actor: AuthenticatedActor,
    rejectReason?: string,
  ) {
    const VALID_STATUSES: BrandTicketStatus[] = ['ACCEPTED', 'PREPARING', 'READY', 'REJECTED'];
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`Unknown ticket status '${status}'`);
    }

    const brandOrder = await this.prisma.brandOrder.findUnique({
      where: { id: brandOrderId },
      include: { order: true, items: true },
    });

    if (!brandOrder) {
      throw new NotFoundException(`Brand ticket ${brandOrderId} not found`);
    }

    this.assertCanManageTicket(brandOrder, actor);

    const allowed = TICKET_TRANSITIONS[brandOrder.status] || [];
    if (!allowed.includes(status)) {
      throw new ConflictException(
        `Ticket ${brandOrderId} cannot move from ${brandOrder.status} to ${status}`,
      );
    }

    if (status === 'REJECTED') {
      return this.rejectBrandOrder(brandOrder, actor, rejectReason);
    }

    // Payment gate: the kitchen must never cook an order that has not been settled.
    const payment = await this.prisma.payment.findUnique({
      where: { orderId: brandOrder.orderId },
      select: { status: true },
    });
    const isSettled = payment?.status === 'SUCCESS' || brandOrder.order.paymentMethod === 'COD';
    if (!isSettled) {
      throw new ConflictException(
        'This order has not been paid yet — the kitchen cannot start preparing it.',
      );
    }

    const updated = await this.prisma.brandOrder.update({
      where: { id: brandOrderId },
      data: { status },
      include: { order: true, items: true },
    });

    // Emit the KDS update to the kitchen room.
    this.websocketsGateway.emitKdsTicketUpdate(updated.order.hubId, updated);

    // Gate: assign a rider once every live ticket has been accepted.
    const siblings = await this.prisma.brandOrder.findMany({
      where: { orderId: brandOrder.orderId },
      select: { status: true },
    });

    const liveTickets = siblings.filter((bo) => bo.status !== 'REJECTED');
    const allAccepted =
      liveTickets.length > 0 &&
      liveTickets.every((bo) => ['ACCEPTED', 'PREPARING', 'READY'].includes(bo.status));

    if (allAccepted) {
      await this.prisma.order.update({
        where: { id: brandOrder.orderId },
        data: { status: 'PREPARING' },
      });

      const tripResult = await this.logisticsService.autoAssignRider(brandOrder.orderId);

      this.websocketsGateway.emitOrderStatusUpdate(brandOrder.orderId, 'PREPARING', {
        orderId: brandOrder.orderId,
        status: 'PREPARING',
        riderAssigned: !!tripResult?.trip,
        trip: tripResult?.trip,
      });
    } else {
      this.websocketsGateway.emitOrderStatusUpdate(brandOrder.orderId, 'TICKET_UPDATED', {
        orderId: brandOrder.orderId,
        brandOrderId,
        status,
      });
    }

    return updated;
  }

  private assertCanManageTicket(
    brandOrder: { brandId: string; order: { hubId: string } },
    actor: AuthenticatedActor,
  ) {
    const role = actor?.role || 'CUSTOMER';

    if (role === 'ADMIN') return;

    if (role === 'BRAND_OPS' && actor.scopedBrandId === brandOrder.brandId) return;

    if (
      (role === 'HUB_STAFF' || role === 'HUB_MANAGER') &&
      actor.scopedHubId &&
      actor.scopedHubId === brandOrder.order.hubId
    ) {
      return;
    }

    throw new ForbiddenException('You cannot manage this kitchen ticket');
  }

  /**
   * Rejects a ticket and refunds the customer.
   *
   * Money rules:
   *  - The transition table guarantees a ticket can only be rejected once, so
   *    repeated calls cannot mint wallet credit.
   *  - A refund is only issued when money was actually collected (a successful
   *    payment or a real wallet debit). An unpaid, abandoned order gets its
   *    totals reduced instead of receiving free wallet credit.
   *  - The status update, refund, and total recalculation are one transaction.
   */
  private async rejectBrandOrder(
    brandOrder: Prisma.BrandOrderGetPayload<{ include: { order: true; items: true } }>,
    actor: AuthenticatedActor,
    rejectReason?: string,
  ) {
    const orderId = brandOrder.orderId;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.brandOrder.update({
        where: { id: brandOrder.id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectReason: rejectReason || 'Kitchen Out of Stock',
        },
        include: { order: true, items: true },
      });

      const siblings = await tx.brandOrder.findMany({
        where: { orderId },
        select: { id: true, status: true },
      });
      const allRejected = siblings.every((bo) => bo.status === 'REJECTED');

      const [successfulPayment, walletSpend] = await Promise.all([
        tx.payment.findUnique({ where: { orderId } }),
        tx.walletTransaction.findFirst({ where: { orderId, reason: 'ORDER_SPEND' } }),
      ]);

      // Refund only money that was actually collected. For COD, the cash
      // portion is not collected until delivery — refunding finalPaidPaise
      // would mint wallet credit out of thin air. A synthetic wallet payment
      // already represents the wallet debit, so it must not be counted twice.
      let collectedPaise = 0;
      if (successfulPayment?.status === 'SUCCESS') {
        collectedPaise += successfulPayment.amountInPaise;
        if (successfulPayment.gateway !== 'wallet' && walletSpend) {
          collectedPaise += updated.order.walletAppliedPaise;
        }
      } else if (walletSpend) {
        collectedPaise += updated.order.walletAppliedPaise;
      }
      const moneyCollected = collectedPaise > 0;

      const itemRefundPaise = updated.items.reduce(
        (sum, item) => sum + item.priceSnapshot * item.quantity,
        0,
      );
      const mrpReductionPaise = updated.items.reduce(
        (sum, item) => sum + (item.mrpSnapshot || item.priceSnapshot) * item.quantity,
        0,
      );
      const savingsReductionPaise = Math.max(0, mrpReductionPaise - itemRefundPaise);

      // Full rejection refunds everything actually collected. Partial rejection
      // can never refund more than was collected.
      const refundPaise = allRejected
        ? collectedPaise
        : Math.min(itemRefundPaise, collectedPaise);

      if (moneyCollected && refundPaise > 0) {
        await tx.user.update({
          where: { id: updated.order.userId },
          data: { walletBalance: { increment: refundPaise } },
        });

        await tx.walletTransaction.create({
          data: {
            userId: updated.order.userId,
            amountInPaise: refundPaise,
            reason: allRejected ? 'ORDER_REFUND' : 'PARTIAL_ORDER_REFUND',
            orderId,
          },
        });
      }

      const newFinalPaidPaise = allRejected
        ? 0
        : Math.max(0, updated.order.finalPaidPaise - itemRefundPaise);
      const newWalletAppliedPaise = allRejected ? 0 : updated.order.walletAppliedPaise;
      const newMrpTotalPaise = Math.max(0, updated.order.mrpTotalPaise - mrpReductionPaise);
      const newMemberSavingsPaise = Math.max(
        0,
        updated.order.memberSavingsPaise - savingsReductionPaise,
      );

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          finalPaidPaise: newFinalPaidPaise,
          walletAppliedPaise: newWalletAppliedPaise,
          mrpTotalPaise: newMrpTotalPaise,
          memberSavingsPaise: newMemberSavingsPaise,
          status: allRejected ? 'CANCELLED' : updated.order.status,
        },
      });

      await tx.auditLog.create({
        data: {
          action: allRejected ? 'ORDER_CANCELLED_KITCHEN_REJECT' : 'BRAND_ORDER_REJECTED',
          actorId: actor?.sub,
          recordId: orderId,
          diff: {
            brandOrderId: updated.id,
            brandId: updated.brandId,
            refundPaise,
            moneyCollected,
            allRejected,
            rejectReason: updated.rejectReason,
          },
        },
      });

      return { updated, order, refundPaise, allRejected, moneyCollected };
    });

    this.logger.warn(
      `💸 Ticket ${result.updated.id} rejected (${result.updated.brandId}). ` +
        `Refund ₹${result.refundPaise / 100} (collected=${result.moneyCollected}, allRejected=${result.allRejected}). ` +
        `Order ${orderId} payable is now ₹${result.order.finalPaidPaise / 100}`,
    );

    this.websocketsGateway.emitOrderStatusUpdate(
      orderId,
      result.allRejected ? 'CANCELLED' : 'PARTIAL_REFUND',
      {
        orderId,
        brandOrderId: result.updated.id,
        brandId: result.updated.brandId,
        refundPaise: result.refundPaise,
        refundRupees: result.refundPaise / 100,
        newFinalPaidPaise: result.order.finalPaidPaise,
        newFinalPaidRupees: result.order.finalPaidPaise / 100,
        allRejected: result.allRejected,
        rejectReason: result.updated.rejectReason,
      },
    );

    this.websocketsGateway.emitBrandOrderRejected(orderId, result.updated.brandId, {
      orderId,
      brandOrderId: result.updated.id,
      brandId: result.updated.brandId,
      rejectReason: result.updated.rejectReason,
      refundPaise: result.refundPaise,
    });

    return result.updated;
  }
}
