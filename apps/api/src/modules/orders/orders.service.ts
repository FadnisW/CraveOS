import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateOrderDto {
  userId: string;
  hubId: string;
  addressId: string;
  items: {
    menuItemId: string;
    brandId: string;
    nameSnapshot: string;
    price: number;
    quantity: number;
  }[];
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOrder(dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Cannot create order with an empty cart');
    }

    const mrpTotalPaise = dto.items.reduce((sum, item) => sum + item.price * 100 * item.quantity, 0);

    // Group cart items by brandId for Multi-Brand Fan-Out
    const itemsByBrand = new Map<string, typeof dto.items>();
    for (const item of dto.items) {
      const existing = itemsByBrand.get(item.brandId) || [];
      existing.push(item);
      itemsByBrand.set(item.brandId, existing);
    }

    this.logger.log(`🚀 Creating order fanning out across ${itemsByBrand.size} brand kitchen tickets.`);

    // Execute atomic transaction for parent Order + N BrandOrders
    return this.prisma.$transaction(async (tx) => {
      // 0. Stock Re-Validation (86 Check): verify all items are available
      const itemIds = dto.items.map((i) => i.menuItemId);
      const dbItems = await tx.menuItem.findMany({
        where: { id: { in: itemIds } },
      });

      for (const cartItem of dto.items) {
        const dbItem = dbItems.find((i) => i.id === cartItem.menuItemId);
        if (dbItem && !dbItem.isAvailable) {
          throw new BadRequestException(`Item '${cartItem.nameSnapshot}' is currently out of stock (86'd).`);
        }
      }

      // 1. Create parent Order
      const parentOrder = await tx.order.create({
        data: {
          userId: dto.userId,
          hubId: dto.hubId,
          addressId: dto.addressId,
          mrpTotalPaise,
          memberSavingsPaise: Math.round(mrpTotalPaise * 0.3),
          deliveryFeePaise: 0,
          packagingFeePaise: 0,
          taxPaise: Math.round(mrpTotalPaise * 0.05),
          finalPaidPaise: Math.round(mrpTotalPaise * 0.75),
          discountBreakdown: { membership: '30%', delivery: 'FREE' },
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
            totalPaise: Math.round(mrpTotalPaise * 0.75),
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
