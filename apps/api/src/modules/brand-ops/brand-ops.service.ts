import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
          order: { createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } },
          status: { notIn: ['REJECTED'] },
        },
        include: { items: true },
      }),
      this.prisma.brandOrder.findMany({
        where: {
          brandId,
          order: { status: { not: 'CANCELLED' } },
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
   *
   * Menu items are stored once per kitchen so each hub can 86 independently.
   * The brand console works on the logical item, so collapse every group to
   * one row and expose the per-hub availability alongside it.
   */
  async getBrandMenu(brandId: string) {
    const items = await this.prisma.menuItem.findMany({
      where: { brandKitchen: { brandId } },
      include: { brandKitchen: { select: { hubId: true } } },
      orderBy: [{ name: 'asc' }, { brandKitchenId: 'asc' }],
    });

    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.menuItemGroupId || item.id;
      const group = groups.get(key) || [];
      group.push(item);
      groups.set(key, group);
    }

    // Deterministic representative: the lexicographically first hub. This is
    // also the row `createMenuItem` returns (kitchens are ordered by hub id).
    for (const group of groups.values()) {
      group.sort((a, b) => a.brandKitchen.hubId.localeCompare(b.brandKitchen.hubId));
    }

    return [...groups.values()].map((group) => {
      const canonical = group[0];
      return {
        ...canonical,
        // The brand-level "Live" switch is only true when every hub is live.
        isAvailable: group.every((row) => row.isAvailable),
        hubIds: group.map((row) => row.brandKitchen.hubId),
        hubAvailability: Object.fromEntries(
          group.map((row) => [row.brandKitchen.hubId, row.isAvailable]),
        ),
      };
    });
  }

  /**
   * Every kitchen a brand serves. A brand with no kitchen is attached to the
   * first hub so a newly created brand is still usable.
   */
  private async kitchensForBrand(brandId: string) {
    let kitchens = await this.prisma.brandKitchen.findMany({
      where: { brandId },
      orderBy: { hubId: 'asc' },
    });

    if (kitchens.length === 0) {
      const defaultHub = await this.prisma.hub.findFirst({ orderBy: { id: 'asc' } });
      if (!defaultHub) {
        throw new BadRequestException('No default hub found to attach brand kitchen');
      }
      const created = await this.prisma.brandKitchen.create({
        data: { brandId, hubId: defaultHub.id, isOpen: true },
      });
      kitchens = [created];
    }

    return kitchens;
  }

  /** The id shared by every per-kitchen copy of one logical menu item. */
  private groupIdOf(item: { id: string; menuItemGroupId?: string | null }) {
    return item.menuItemGroupId || item.id;
  }

  /** Prisma filter matching every copy of a logical item. */
  private groupWhere(item: { id: string; menuItemGroupId?: string | null }) {
    return item.menuItemGroupId
      ? { OR: [{ id: item.id }, { menuItemGroupId: item.menuItemGroupId }] }
      : { id: item.id };
  }

  /**
   * Validate the money fields shared by create and update. Negative or
   * fractional paise would poison pricing, so reject them at the boundary.
   */
  private assertPriceFields(mrpInPaise: any, memberPriceInPaise?: any) {
    const mrp = Number(mrpInPaise);
    if (!Number.isInteger(mrp) || mrp <= 0) {
      throw new BadRequestException('mrpInPaise must be a positive whole number of paise');
    }

    if (memberPriceInPaise === undefined || memberPriceInPaise === null) {
      return { mrp, member: Math.round(mrp * 0.7) };
    }

    const member = Number(memberPriceInPaise);
    if (!Number.isInteger(member) || member <= 0) {
      throw new BadRequestException(
        'memberPriceInPaise must be a positive whole number of paise',
      );
    }
    if (member > mrp) {
      throw new BadRequestException('memberPriceInPaise cannot exceed mrpInPaise');
    }

    return { mrp, member };
  }

  /**
   * Create Menu Item for Brand (§5.2)
   */
  async createMenuItem(brandId: string, data: any) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException(`Brand '${brandId}' not found`);

    const name = String(data?.name || '').trim();
    if (!name) throw new BadRequestException('A menu item name is required');

    const { mrp, member } = this.assertPriceFields(
      data?.mrpInPaise,
      data?.memberPriceInPaise,
    );

    // Create one row per kitchen. A single HSR-only row is why a second hub's
    // stock board was empty and its checkout failed with a cross-hub conflict.
    const kitchens = await this.kitchensForBrand(brandId);
    const groupId = randomUUID();

    const payload = {
      name,
      description: data.description || '',
      mrpInPaise: mrp,
      memberPriceInPaise: member,
      imageUrl:
        data.imageUrl ||
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
      isVeg: data.isVeg !== undefined ? data.isVeg : true,
      isBestseller: data.isBestseller || false,
      isAvailable: data.isAvailable !== undefined ? !!data.isAvailable : true,
      category: data.category || 'Main Course',
      rating: data.rating || 4.8,
      dietType: data.dietType || (data.isVeg ? 'VEG' : 'NON_VEG'),
      spiceLevel: data.spiceLevel || 0,
      gstPct: data.gstPct || 5,
      variants: data.variants || null,
      addOns: data.addOns || null,
      scheduledFrom: data.scheduledFrom || null,
      scheduledTo: data.scheduledTo || null,
    };

    const rows = await this.prisma.$transaction(
      kitchens.map((kitchen) =>
        this.prisma.menuItem.create({
          data: {
            ...payload,
            brandKitchenId: kitchen.id,
            menuItemGroupId: groupId,
          },
        }),
      ),
    );

    return {
      ...rows[0],
      hubIds: kitchens.map((kitchen) => kitchen.hubId),
    };
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

    // Whitelist mutable fields instead of passing the request body to Prisma.
    const allowed = [
      'name',
      'description',
      'mrpInPaise',
      'memberPriceInPaise',
      'imageUrl',
      'isVeg',
      'isBestseller',
      'isAvailable',
      'category',
      'rating',
      'dietType',
      'spiceLevel',
      'gstPct',
      'variants',
      'addOns',
      'scheduledFrom',
      'scheduledTo',
    ];

    const patch: Record<string, any> = {};
    for (const key of allowed) {
      if (data?.[key] !== undefined) patch[key] = data[key];
    }

    if (patch.mrpInPaise !== undefined || patch.memberPriceInPaise !== undefined) {
      const { mrp, member } = this.assertPriceFields(
        patch.mrpInPaise ?? item.mrpInPaise,
        patch.memberPriceInPaise ?? item.memberPriceInPaise,
      );
      patch.mrpInPaise = mrp;
      patch.memberPriceInPaise = member;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No editable menu item fields were supplied');
    }

    // Menu content and the brand-level Live switch apply to every kitchen.
    // Per-hub 86 lives on the hub-ops / catalog route instead.
    await this.prisma.menuItem.updateMany({
      where: this.groupWhere(item),
      data: patch,
    });

    return this.prisma.menuItem.findUnique({ where: { id: itemId } });
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

    const result = await this.prisma.menuItem.deleteMany({
      where: this.groupWhere(item),
    });

    return { id: itemId, deleted: true, copies: result.count };
  }

  /**
   * Bulk Price Update (§5.2)
   * Adjust prices across items in this brand by a flat amount or percentage
   */
  async bulkUpdatePrice(
    brandId: string,
    updates: { itemId: string; mrpInPaise: number; memberPriceInPaise?: number }[],
  ) {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new BadRequestException('updates must be a non-empty array');
    }
    if (updates.length > 500) {
      throw new BadRequestException('Cannot update more than 500 items at once');
    }

    // Resolve every item up front and verify brand ownership before writing.
    // The previous version updated any id supplied by the caller, which let a
    // brand operator rewrite another brand's menu prices.
    const itemIds = updates.map((u) => u?.itemId).filter(Boolean);
    const items = await this.prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      include: { brandKitchen: { select: { brandId: true } } },
    });
    const byId = new Map(items.map((item) => [item.id, item]));

    // Several updates can target copies of the same logical item. Collapse
    // them by group so the last price supplied wins and every kitchen copy
    // stays in sync.
    const patches = new Map<
      string,
      { where: any; mrpInPaise: number; memberPriceInPaise: number }
    >();

    for (const u of updates) {
      const item = byId.get(u?.itemId);
      if (!item) {
        throw new NotFoundException(`MenuItem '${u?.itemId}' not found`);
      }
      if (item.brandKitchen.brandId !== brandId) {
        throw new BadRequestException(
          `MenuItem '${u.itemId}' does not belong to brand '${brandId}'`,
        );
      }

      const { mrp, member } = this.assertPriceFields(
        u.mrpInPaise,
        u.memberPriceInPaise,
      );

      patches.set(this.groupIdOf(item), {
        where: this.groupWhere(item),
        mrpInPaise: mrp,
        memberPriceInPaise: member,
      });
    }

    return this.prisma.$transaction(
      [...patches.values()].map((patch) =>
        this.prisma.menuItem.updateMany({
          where: patch.where,
          data: {
            mrpInPaise: patch.mrpInPaise,
            memberPriceInPaise: patch.memberPriceInPaise,
          },
        }),
      ),
    );
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
    const validTypes = ['HAPPY_HOUR', 'MEAL_OF_DAY', 'BOGO', 'COUPON'];
    if (!validTypes.includes(data?.type)) {
      throw new BadRequestException(`type must be one of ${validTypes.join(', ')}`);
    }

    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException(`Brand '${brandId}' not found`);

    const startsAt = new Date(data?.startsAt);
    const endsAt = new Date(data?.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('startsAt and endsAt must be valid dates');
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    return this.prisma.pricingRule.create({
      data: {
        type: data.type,
        brandId,
        startsAt,
        endsAt,
        config: {
          ...(data.config || {}),
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

    const itemMap: Record<
      string,
      { menuItemId: string; name: string; quantitySold: number; revenuePaise: number }
    > = {};
    let rejectedCount = 0;

    for (const bo of brandOrders) {
      if (bo.status === 'REJECTED') {
        rejectedCount += 1;
        continue;
      }
      for (const item of bo.items) {
        // The same logical item has one row per kitchen. Group by the name
        // snapshot so a dish sold at two hubs is one line, not two.
        const key = item.nameSnapshot || item.menuItemId;
        if (!itemMap[key]) {
          itemMap[key] = {
            menuItemId: item.menuItemId,
            name: item.nameSnapshot,
            quantitySold: 0,
            revenuePaise: 0,
          };
        }
        itemMap[key].quantitySold += item.quantity;
        itemMap[key].revenuePaise += item.priceSnapshot * item.quantity;
      }
    }

    const itemsPerformance = Object.values(itemMap)
      .map((val) => ({
        menuItemId: val.menuItemId,
        name: val.name,
        quantitySold: val.quantitySold,
        revenuePaise: val.revenuePaise,
        revenueRupees: val.revenuePaise / 100,
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold);

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
      where: {
        brandId,
        status: { notIn: ['REJECTED'] },
        // Only count orders whose money actually settled. Unpaid UPI orders
        // and cancelled baskets must not inflate brand GMV.
        order: {
          status: { not: 'CANCELLED' },
          OR: [{ payment: { status: 'SUCCESS' } }, { paymentMethod: 'COD', status: 'DELIVERED' }],
        },
      },
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
