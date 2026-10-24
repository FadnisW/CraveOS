import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BrandOpsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Brand Ops Dashboard (§5.2)
   */
  async getBrandDashboard(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        brandKitchens: {
          include: {
            hub: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand '${brandId}' not found`);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayBrandOrders, allBrandOrders] = await Promise.all([
      this.prisma.brandOrder.findMany({
        where: {
          brandId,
          order: { createdAt: { gte: todayStart } },
          status: { notIn: ['REJECTED'] },
        },
        include: { items: true },
      }),
      this.prisma.brandOrder.findMany({
        where: {
          brandId,
          status: { notIn: ['REJECTED'] },
        },
        include: { items: true },
      }),
    ]);

    const todayRevenuePaise = todayBrandOrders.reduce(
      (sum, bo) => sum + bo.items.reduce((iSum, i) => iSum + i.priceSnapshot * i.quantity, 0),
      0,
    );

    const lifetimeRevenuePaise = allBrandOrders.reduce(
      (sum, bo) => sum + bo.items.reduce((iSum, i) => iSum + i.priceSnapshot * i.quantity, 0),
      0,
    );

    return {
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        themeColor: brand.themeColor,
        kitchensCount: brand.brandKitchens.length,
        activeHubs: brand.brandKitchens.map((k) => ({
          hubId: k.hubId,
          hubName: k.hub.name,
          isOpen: k.isOpen,
        })),
      },
      metrics: {
        todayOrderCount: todayBrandOrders.length,
        todayRevenuePaise,
        todayRevenueRupees: todayRevenuePaise / 100,
        totalOrderCount: allBrandOrders.length,
        lifetimeRevenuePaise,
        lifetimeRevenueRupees: lifetimeRevenuePaise / 100,
      },
    };
  }

  /**
   * Get Brand Menu (§5.2)
   */
  async getBrandMenu(brandId: string) {
    const brandKitchen = await this.prisma.brandKitchen.findFirst({
      where: { brandId },
      include: {
        menuItems: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!brandKitchen) {
      // Fallback: Check if any brand kitchen exists
      const anyKitchen = await this.prisma.brandKitchen.findFirst();
      if (!anyKitchen) return [];
    }

    return brandKitchen?.menuItems || [];
  }

  /**
   * Create Menu Item for Brand (§5.2)
   */
  async createMenuItem(brandId: string, data: any) {
    // Find or link with the brand's kitchen
    let brandKitchen = await this.prisma.brandKitchen.findFirst({
      where: { brandId },
    });

    if (!brandKitchen) {
      // Link to first available hub
      const defaultHub = await this.prisma.hub.findFirst();
      if (!defaultHub) throw new BadRequestException('No default hub found to attach brand kitchen');

      brandKitchen = await this.prisma.brandKitchen.create({
        data: {
          brandId,
          hubId: defaultHub.id,
          isOpen: true,
        },
      });
    }

    return this.prisma.menuItem.create({
      data: {
        brandKitchenId: brandKitchen.id,
        name: data.name,
        description: data.description || '',
        mrpInPaise: data.mrpInPaise,
        memberPriceInPaise: data.memberPriceInPaise || Math.round(data.mrpInPaise * 0.7),
        imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        isVeg: data.isVeg !== undefined ? data.isVeg : true,
        isBestseller: data.isBestseller || false,
        category: data.category || 'Main Course',
        rating: data.rating || 4.8,
        dietType: data.dietType || (data.isVeg ? 'VEG' : 'NON_VEG'),
        spiceLevel: data.spiceLevel || 0,
        gstPct: data.gstPct || 5,
        variants: data.variants || null,
        addOns: data.addOns || null,
        scheduledFrom: data.scheduledFrom || null,
        scheduledTo: data.scheduledTo || null,
      },
    });
  }

  /**
   * Update Menu Item (§5.2)
   */
  async updateMenuItem(brandId: string, itemId: string, data: any) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      include: { brandKitchen: true },
    });

    if (!item) {
      throw new NotFoundException(`MenuItem '${itemId}' not found`);
    }

    if (item.brandKitchen.brandId !== brandId) {
      throw new BadRequestException(`MenuItem '${itemId}' does not belong to brand '${brandId}'`);
    }

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data,
    });
  }

  /**
   * Delete Menu Item (§5.2)
   */
  async deleteMenuItem(brandId: string, itemId: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      include: { brandKitchen: true },
    });

    if (!item) throw new NotFoundException(`MenuItem '${itemId}' not found`);
    if (item.brandKitchen.brandId !== brandId) {
      throw new BadRequestException(`MenuItem '${itemId}' does not belong to brand '${brandId}'`);
    }

    return this.prisma.menuItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * Bulk Price Update (§5.2)
   * Adjust prices across items in this brand by a flat amount or percentage
   */
  async bulkUpdatePrice(
    brandId: string,
    updates: { itemId: string; mrpInPaise: number; memberPriceInPaise?: number }[],
  ) {
    const results: any[] = [];
    for (const u of updates) {
      const updated = await this.prisma.menuItem.update({
        where: { id: u.itemId },
        data: {
          mrpInPaise: u.mrpInPaise,
          memberPriceInPaise: u.memberPriceInPaise || Math.round(u.mrpInPaise * 0.7),
        },
      });
      results.push(updated);
    }
    return results;
  }

  /**
   * Propose Promotion (§5.2)
   * Submits a promotion proposal to Super Admin approval queue
   */
  async proposePromotion(
    brandId: string,
    data: {
      type: 'HAPPY_HOUR' | 'MEAL_OF_DAY' | 'BOGO' | 'COUPON';
      startsAt: string;
      endsAt: string;
      config: any;
    },
  ) {
    return this.prisma.pricingRule.create({
      data: {
        type: data.type,
        brandId,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        config: {
          ...data.config,
          status: 'PENDING_ADMIN_APPROVAL',
          proposedByBrandId: brandId,
          proposedAt: new Date(),
        },
      },
    });
  }

  /**
   * Brand Analytics (§5.2)
   * Item sales performance, velocity & rejection rates
   */
  async getBrandAnalytics(brandId: string) {
    const brandOrders = await this.prisma.brandOrder.findMany({
      where: { brandId },
      include: { items: true },
    });

    const itemMap: Record<string, { name: string; quantitySold: number; revenuePaise: number }> = {};
    let rejectedCount = 0;

    for (const bo of brandOrders) {
      if (bo.status === 'REJECTED') {
        rejectedCount += 1;
        continue;
      }
      for (const item of bo.items) {
        if (!itemMap[item.menuItemId]) {
          itemMap[item.menuItemId] = {
            name: item.nameSnapshot,
            quantitySold: 0,
            revenuePaise: 0,
          };
        }
        itemMap[item.menuItemId].quantitySold += item.quantity;
        itemMap[item.menuItemId].revenuePaise += item.priceSnapshot * item.quantity;
      }
    }

    const itemsPerformance = Object.entries(itemMap).map(([id, val]) => ({
      menuItemId: id,
      name: val.name,
      quantitySold: val.quantitySold,
      revenuePaise: val.revenuePaise,
      revenueRupees: val.revenuePaise / 100,
    })).sort((a, b) => b.quantitySold - a.quantitySold);

    return {
      brandId,
      totalOrders: brandOrders.length,
      rejectedOrders: rejectedCount,
      rejectionRatePct: brandOrders.length > 0 ? Math.round((rejectedCount / brandOrders.length) * 1000) / 10 : 0,
      topSellers: itemsPerformance.slice(0, 10),
    };
  }

  /**
   * Brand Finance (§5.2)
   */
  async getBrandFinance(brandId: string) {
    const brandOrders = await this.prisma.brandOrder.findMany({
      where: { brandId, status: { notIn: ['REJECTED'] } },
      include: { items: true },
    });

    const grossMerchandiseValuePaise = brandOrders.reduce(
      (sum, bo) => sum + bo.items.reduce((iSum, i) => iSum + i.priceSnapshot * i.quantity, 0),
      0,
    );

    return {
      brandId,
      grossMerchandiseValuePaise,
      grossMerchandiseValueRupees: grossMerchandiseValuePaise / 100,
      fulfilledOrdersCount: brandOrders.length,
      avgTicketValueRupees: brandOrders.length > 0 ? Math.round(grossMerchandiseValuePaise / brandOrders.length) / 100 : 0,
    };
  }
}
