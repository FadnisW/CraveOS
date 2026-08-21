import { Injectable, BadRequestException, ConflictException, NotFoundException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { Queue } from 'bullmq';
import { KITCHEN_QUEUE } from '../queue/queue.constants';

export interface CreateOrderDto {
  userId: string;
  hubId: string;
  addressId: string;
  couponCode?: string;
  useWalletBalance?: number;
  items: {
    menuItemId: string;
    brandId: string;
    nameSnapshot: string;
    mrp?: number;
    price: number;
    quantity: number;
  }[];
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    @Inject(KITCHEN_QUEUE) private readonly kitchenQueue: Queue,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Cannot create order with an empty cart');
    }

    // Check if user is EatClub Member
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { membership: true },
    });
    const isMember = user?.membership?.status === 'ACTIVE' || user?.membership?.status === 'TRIAL' || true; // Default member benefits in EatClub app

    // Compute deterministic pricing using PricingService
    // Map items to calculateCartPrice input (using MRP if provided, else price * 1.3)
    const pricingInput = {
      items: dto.items.map((i) => ({
        price: i.mrp || Math.round(i.price * 1.3),
        quantity: i.quantity,
      })),
      isMember,
      couponCode: dto.couponCode,
      useWalletBalance: dto.useWalletBalance,
    };

    const priceBreakdown = await this.pricingService.calculateCartPrice(pricingInput);

    const mrpTotalPaise = Math.round(priceBreakdown.itemTotal * 100);
    const memberSavingsPaise = Math.round(priceBreakdown.memberDiscount * 100);
    const deliveryFeePaise = Math.round(priceBreakdown.deliveryFee * 100);
    const packagingFeePaise = Math.round(priceBreakdown.packagingFee * 100);
    const taxPaise = Math.round(priceBreakdown.taxes * 100);
    const finalPaidPaise = Math.round(priceBreakdown.finalPayable * 100);

    // Group cart items by brandId for Multi-Brand Fan-Out
    const itemsByBrand = new Map<string, typeof dto.items>();
    for (const item of dto.items) {
      const existing = itemsByBrand.get(item.brandId) || [];
      existing.push(item);
      itemsByBrand.set(item.brandId, existing);
    }

    this.logger.log(`🚀 Creating order fanning out across ${itemsByBrand.size} brand kitchen tickets. Final Payable: ₹${priceBreakdown.finalPayable}`);

    // Execute atomic transaction for parent Order + N BrandOrders
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      // 0. Stock Re-Validation (86 Check) and Cross-Hub Kitchen Validation
      const itemIds = dto.items.map((i) => i.menuItemId);
      const dbItems = await tx.menuItem.findMany({
        where: { id: { in: itemIds } },
        include: {
          brandKitchen: true,
        },
      });

      for (const cartItem of dto.items) {
        const dbItem = dbItems.find((i) => i.id === cartItem.menuItemId);
        if (!dbItem) {
          throw new BadRequestException(`Item '${cartItem.nameSnapshot}' was not found.`);
        }
        if (!dbItem.isAvailable) {
          throw new ConflictException(`Item '${cartItem.nameSnapshot}' is currently out of stock (86'd).`);
        }
        // Verify item belongs to a kitchen in the designated hub
        if (dbItem.brandKitchen && dbItem.brandKitchen.hubId !== dto.hubId) {
          throw new BadRequestException(
            `Cross-Hub Conflict: Item '${cartItem.nameSnapshot}' is from hub '${dbItem.brandKitchen.hubId}', but order is pinned to hub '${dto.hubId}'.`,
          );
        }
      }

      // 1. Create parent Order
      const parentOrder = await tx.order.create({
        data: {
          userId: dto.userId,
          hubId: dto.hubId,
          addressId: dto.addressId,
          mrpTotalPaise,
          memberSavingsPaise,
          deliveryFeePaise,
          packagingFeePaise,
          taxPaise,
          finalPaidPaise,
          discountBreakdown: priceBreakdown.savingsSummary,
          status: 'PLACED',
        },
      });

      // 2. Create BrandOrders for each virtual kitchen
      for (const [brandId, brandItems] of itemsByBrand.entries()) {
        await tx.brandOrder.create({
          data: {
            orderId: parentOrder.id,
            brandId,
            status: 'SENT_TO_KITCHEN',
            items: {
              create: brandItems.map((i) => ({
                menuItemId: i.menuItemId,
                nameSnapshot: i.nameSnapshot,
                priceSnapshot: Math.round(i.price * 100),
                quantity: i.quantity,
              })),
            },
          },
        });
      }

      // 3. Create AuditLog entry for financial tracking
      await tx.auditLog.create({
        data: {
          action: 'ORDER_CREATED',
          actorId: dto.userId,
          recordId: parentOrder.id,
          diff: {
            finalPaidPaise,
            mrpTotalPaise,
            memberSavingsPaise,
            brandCount: itemsByBrand.size,
          },
        },
      });

      return tx.order.findUnique({
        where: { id: parentOrder.id },
        include: {
          brandOrders: {
            include: {
              items: true,
            },
          },
          address: true,
          hub: true,
        },
      });
    });

    // Post-transaction: Enqueue BullMQ jobs for asynchronous kitchen notifications
    if (createdOrder && createdOrder.brandOrders) {
      for (const brandOrder of createdOrder.brandOrders) {
        try {
          await this.kitchenQueue.add('brand_order.created', {
            hubId: dto.hubId,
            orderId: createdOrder.id,
            brandOrder,
          });
          this.logger.log(`🐂 Enqueued BullMQ job 'brand_order.created' for ticket ${brandOrder.id}`);
        } catch (queueErr: any) {
          this.logger.warn(`Failed to enqueue BullMQ job: ${queueErr.message}`);
        }
      }
    }

    return createdOrder;
  }

  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        brandOrders: {
          include: {
            items: true,
          },
        },
        address: true,
        hub: true,
        deliveryTrip: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return order;
  }

  async updateBrandOrderStatus(brandOrderId: string, status: 'ACCEPTED' | 'PREPARING' | 'READY' | 'REJECTED') {
    const brandOrder = await this.prisma.brandOrder.update({
      where: { id: brandOrderId },
      data: {
        status: status as any,
        ...(status === 'REJECTED' ? { rejectedAt: new Date(), rejectReason: 'Kitchen Out of Stock' } : {}),
      },
      include: { order: true, items: true },
    });

    // If a kitchen rejects an order, instantly issue partial refund to customer wallet
    if (status === 'REJECTED') {
      const refundPaise = brandOrder.items.reduce((sum, i) => sum + i.priceSnapshot * i.quantity, 0);
      await this.prisma.walletTransaction.create({
        data: {
          userId: brandOrder.order.userId,
          amountInPaise: refundPaise,
          reason: 'PARTIAL_ORDER_REFUND',
          orderId: brandOrder.orderId,
        },
      });
      this.logger.warn(`💸 Brand Order ${brandOrder.id} rejected. Issued ₹${refundPaise / 100} wallet refund.`);
    }

    return brandOrder;
  }

  async getUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        brandOrders: {
          include: {
            items: true,
          },
        },
      },
    });
  }
}
