import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import {
  getWalletRefundsByOrder,
  localDayKey,
  netCollectedPaise,
} from '../../common/utils/revenue';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * Get high-level system KPIs for Admin Dashboard
   */
  async getDashboardKPIs() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      todayOrders,
      activeRiders,
      pendingRiderApprovals,
      openTickets,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({
        where: {
          createdAt: { gte: todayStart },
        },
      }),
      this.prisma.rider.count({
        where: { isOnline: true, status: 'APPROVED' },
      }),
      this.prisma.rider.count({
        where: { status: 'PENDING_APPROVAL' },
      }),
      this.prisma.ticket.count({
        where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
      }),
    ]);

    return {
      totalOrders,
      todayOrders,
      activeRiders,
      pendingRiderApprovals,
      openTickets,
    };
  }

  /**
   * Fetch active delivery trips for live monitoring
   */
  async getLiveOrdersMap() {
    return this.prisma.deliveryTrip.findMany({
      where: {
        status: { in: ['ASSIGNED', 'ACCEPTED', 'ARRIVED_AT_HUB', 'PICKED_UP', 'ARRIVING'] },
      },
      include: {
        order: {
          include: {
            address: true,
            hub: true,
            user: { select: { id: true, name: true, phone: true } },
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
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Search / list registered users
   */
  async getUsers(filters?: { search?: string }) {
    const where: any = {};

    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
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
        adminSubRole: true,
        scopedHubId: true,
        scopedBrandId: true,
        walletBalance: true,
        createdAt: true,
        membership: {
          select: {
            status: true,
            planId: true,
            trialEndsAt: true,
            renewsAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Get complete user profile detailing order history & wallet transactions
   */
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        membership: true,
        orders: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            hub: true,
            brandOrders: true,
          },
        },
        walletTxns: {
          take: 30,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  /**
   * Atomically adjust user wallet balance and append transaction record.
   * Admin adjustments are money movements, so they are validated, serialized
   * with a row lock, prevented from going negative, and audited.
   */
  async adjustWallet(
    userId: string,
    amountInPaise: number,
    reason: string,
    actorId: string,
  ) {
    const amount = Number(amountInPaise);
    if (!Number.isInteger(amount) || amount === 0) {
      throw new BadRequestException(
        'amountInPaise must be a non-zero whole number of paise',
      );
    }

    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) {
      throw new BadRequestException('A reason is required for a wallet adjustment');
    }

    const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Serialize concurrent adjustments for the same wallet.
      await tx.$executeRaw`SELECT "walletBalance" FROM "users" WHERE id = ${userId} FOR UPDATE`;

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true },
      });

      const nextBalance = (current?.walletBalance ?? 0) + amount;
      if (nextBalance < 0) {
        throw new ConflictException(
          'This adjustment would make the wallet balance negative',
        );
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          walletBalance: {
            increment: amount,
          },
        },
      });

      const txn = await tx.walletTransaction.create({
        data: {
          userId,
          amountInPaise: amount,
          reason: trimmedReason,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'WALLET_ADJUSTED',
          actorId,
          recordId: userId,
          diff: {
            amountInPaise: amount,
            reason: trimmedReason,
            previousBalancePaise: current?.walletBalance ?? 0,
            newBalancePaise: updatedUser.walletBalance,
          },
        },
      });

      return {
        user: updatedUser,
        transaction: txn,
      };
    });
  }

  /**
   * Get orders filterable by status and hubId
   */
  async getOrders(filters?: { status?: string; hubId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.hubId) where.hubId = filters.hubId;

    return this.prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        hub: true,
        address: true,
        brandOrders: {
          include: { items: true },
        },
        deliveryTrip: {
          include: { rider: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Manually reassign a delivery trip to a different rider
   */
  async manuallyReassignRider(orderId: string, newRiderId: string) {
    const trip = await this.prisma.deliveryTrip.findUnique({
      where: { orderId },
    });

    if (!trip) {
      throw new NotFoundException(`No delivery trip found for Order '${orderId}'`);
    }

    const newRider = await this.prisma.rider.findUnique({
      where: { id: newRiderId },
    });

    if (!newRider) {
      throw new NotFoundException(`Rider with ID '${newRiderId}' not found`);
    }

    return this.prisma.deliveryTrip.update({
      where: { id: trip.id },
      data: {
        riderId: newRiderId,
        status: 'ASSIGNED',
      },
      include: {
        rider: true,
        order: true,
      },
    });
  }

  /**
   * Admin Dashboard: Order distribution across brands and hubs
   */
  async getOrderDistribution() {
    const [brands, hubs, orders, refunds] = await Promise.all([
      this.prisma.brand.findMany({
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.hub.findMany({
        select: { id: true, name: true, city: true },
      }),
      this.prisma.order.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: {
          id: true,
          hubId: true,
          status: true,
          paymentMethod: true,
          finalPaidPaise: true,
          walletAppliedPaise: true,
          payment: {
              select: {
                status: true,
                amountInPaise: true,
                gateway: true,
                refundedAmountPaise: true,
              },
            },
          brandOrders: {
            select: {
              brandId: true,
              status: true,
              items: { select: { priceSnapshot: true, quantity: true } },
            },
          },
        },
      }),
      getWalletRefundsByOrder(this.prisma),
    ]);

    const brandMap: Record<string, { count: number; revenue: number }> = {};
    const hubMap: Record<string, { count: number; revenue: number }> = {};

    for (const order of orders) {
      const { collectedPaise } = netCollectedPaise(order, refunds.get(order.id) ?? 0);

      if (!hubMap[order.hubId]) hubMap[order.hubId] = { count: 0, revenue: 0 };
      hubMap[order.hubId].count += 1;
      hubMap[order.hubId].revenue += collectedPaise;

      // Rejected tickets never earn revenue. Allocate the order's collected
      // money across the live tickets by item value so the brand totals add up
      // to the hub total (and to the finance revenue report).
      const liveTickets = order.brandOrders.filter((bo) => bo.status !== 'REJECTED');
      const ticketValue = (ticket: (typeof liveTickets)[number]) =>
        ticket.items.reduce((sum, item) => sum + item.priceSnapshot * item.quantity, 0);
      const totalValue = liveTickets.reduce((sum, ticket) => sum + ticketValue(ticket), 0);

      let allocatedPaise = 0;
      liveTickets.forEach((ticket, index) => {
        if (!brandMap[ticket.brandId]) {
          brandMap[ticket.brandId] = { count: 0, revenue: 0 };
        }
        brandMap[ticket.brandId].count += 1;

        const share =
          index === liveTickets.length - 1
            ? collectedPaise - allocatedPaise
            : totalValue > 0
              ? Math.round((collectedPaise * ticketValue(ticket)) / totalValue)
              : 0;

        allocatedPaise += share;
        brandMap[ticket.brandId].revenue += share;
      });
    }

    return {
      brands: brands.map((b) => ({
        brandId: b.id,
        brandName: b.name,
        orderCount: brandMap[b.id]?.count || 0,
        revenuePaise: brandMap[b.id]?.revenue || 0,
      })),
      hubs: hubs.map((h) => ({
        hubId: h.id,
        hubName: h.name,
        city: h.city,
        orderCount: hubMap[h.id]?.count || 0,
        revenuePaise: hubMap[h.id]?.revenue || 0,
      })),
    };
  }

  /**
   * Local calendar day key (`YYYY-MM-DD`).
   *
   * `toISOString()` is UTC, which shifts every IST order after 05:30 into the
   * previous day and makes the revenue chart disagree with the operator's date.
   */
  /**
   * Admin Dashboard: Revenue trend over the last 7 days
   */
  async getRevenueTrend() {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const [orders, refunds] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: since },
          status: { not: 'CANCELLED' },
        },
        select: {
          id: true,
          createdAt: true,
          status: true,
          paymentMethod: true,
          finalPaidPaise: true,
          walletAppliedPaise: true,
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

    const days: { date: string; revenuePaise: number; orderCount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const dayKey = localDayKey(d);
      const dayOrders = orders.filter(
        (order) => localDayKey(order.createdAt) === dayKey,
      );

      let revenuePaise = 0;
      let orderCount = 0;
      for (const order of dayOrders) {
        const { collectedPaise } = netCollectedPaise(order, refunds.get(order.id) ?? 0);
        if (collectedPaise > 0) {
          revenuePaise += collectedPaise;
          orderCount += 1;
        }
      }

      days.push({ date: dayKey, revenuePaise, orderCount });
    }

    return days;
  }

  /**
   * User Management: Block or unblock a user
   */
  async blockUser(id: string, blocked: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    if (user.role === 'ADMIN' && user.adminSubRole === 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin accounts cannot be blocked');
    }

    // `isBlocked` is a dedicated flag. The old implementation wrote the string
    // 'BLOCKED' into `role`, which is not a role — and unblocking always reset
    // the account to CUSTOMER, destroying HUB_MANAGER / ADMIN assignments.
    return this.prisma.user.update({
      where: { id },
      data: { isBlocked: blocked },
    });
  }

  /**
   * User Management: DPDP Compliance Right-to-Erasure (Anonymize user record)
   */
  async deleteUserData(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: 'Deleted User',
        email: `anonymized_${Date.now()}@eatclub.invalid`,
        phone: `+910000000000_${Date.now()}`,
        walletBalance: 0,
      },
    });
  }

  /**
   * Hub Management: Create a new physical hub
   */
  async createHub(data: {
    name: string;
    city: string;
    lat: number;
    lng: number;
    servicePolygon: any;
    operatingHoursStart?: string;
    operatingHoursEnd?: string;
  }) {
    if (!data?.name?.trim() || !data?.city?.trim()) {
      throw new BadRequestException('Hub name and city are required');
    }
    if (!Number.isFinite(Number(data.lat)) || !Number.isFinite(Number(data.lng))) {
      throw new BadRequestException('Hub latitude and longitude are required');
    }
    if (!data.servicePolygon) {
      throw new BadRequestException('A service polygon is required');
    }

    return this.prisma.hub.create({
      data: {
        name: data.name.trim(),
        city: data.city.trim(),
        lat: Number(data.lat),
        lng: Number(data.lng),
        servicePolygon: data.servicePolygon,
        operatingHoursStart: data.operatingHoursStart || '08:00',
        operatingHoursEnd: data.operatingHoursEnd || '03:00',
      },
    });
  }

  /**
   * Hub Management: Update hub details
   */
  async updateHub(id: string, data: any) {
    const hub = await this.prisma.hub.findUnique({ where: { id } });
    if (!hub) throw new NotFoundException(`Hub ${id} not found`);

    // Whitelist mutable fields. Passing the request body straight to Prisma
    // let a caller rewrite the primary key or unrelated columns.
    const allowed = [
      'name',
      'city',
      'lat',
      'lng',
      'servicePolygon',
      'operatingHoursStart',
      'operatingHoursEnd',
    ];
    const patch: Record<string, any> = {};
    for (const key of allowed) {
      if (data?.[key] !== undefined) patch[key] = data[key];
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No editable hub fields were supplied');
    }

    return this.prisma.hub.update({ where: { id }, data: patch });
  }

  /**
   * Hub Management: Assign staff to hub
   */
  async assignStaffToHub(hubId: string, userId: string, role: 'HUB_STAFF' | 'HUB_MANAGER') {
    const hub = await this.prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) throw new NotFoundException(`Hub ${hubId} not found`);

    if (role !== 'HUB_STAFF' && role !== 'HUB_MANAGER') {
      throw new BadRequestException('role must be HUB_STAFF or HUB_MANAGER');
    }

    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException(`User ${userId} not found`);
    if (target.role === 'ADMIN' || target.role === 'RIDER' || target.role === 'BRAND_OPS') {
      throw new ForbiddenException(
        'Admin, rider, and brand-ops accounts cannot be reassigned as hub staff',
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        role,
        scopedHubId: hubId,
        scopedBrandId: null,
        adminSubRole: null,
      },
    });
  }

  /**
   * Brand Management: Create a new virtual restaurant brand
   */
  async createBrand(data: {
    name: string;
    slug: string;
    tagline?: string;
    cuisine: string[];
    logoUrl: string;
    heroImageUrl: string;
    themeColor?: string;
    minOrderValue?: number;
  }) {
    return this.prisma.brand.create({
      data: {
        name: data.name,
        slug: data.slug,
        tagline: data.tagline || '',
        cuisine: data.cuisine,
        logoUrl: data.logoUrl,
        heroImageUrl: data.heroImageUrl,
        themeColor: data.themeColor || '#FF6B00',
        minOrderValue: data.minOrderValue || 14900,
      },
    });
  }

  /**
   * Brand Management: Update brand details
   */
  async updateBrand(id: string, data: any) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException(`Brand ${id} not found`);

    const allowed = [
      'name',
      'slug',
      'tagline',
      'cuisine',
      'logoUrl',
      'heroImageUrl',
      'themeColor',
      'isActive',
      'isOwned',
      'commissionPct',
      'minOrderValue',
    ];
    const patch: Record<string, any> = {};
    for (const key of allowed) {
      if (data?.[key] !== undefined) patch[key] = data[key];
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No editable brand fields were supplied');
    }

    return this.prisma.brand.update({ where: { id }, data: patch });
  }

  /**
   * Brand Management: Assign brand ops manager
   */
  async assignBrandOps(brandId: string, userId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException(`Brand ${brandId} not found`);

    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException(`User ${userId} not found`);
    if (target.role === 'ADMIN' || target.role === 'RIDER') {
      throw new ForbiddenException('Admin and rider accounts cannot be reassigned as brand ops');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'BRAND_OPS',
        scopedBrandId: brandId,
        scopedHubId: null,
        adminSubRole: null,
      },
    });
  }

  /**
   * Finance: refund a captured payment back to its source.
   */
  async refundOrder(
    orderId: string,
    amountPaise: number | undefined,
    reason: string,
    actorId: string,
  ) {
    return this.payments.refundOrder(orderId, amountPaise, reason || 'Admin refund', actorId);
  }

  /**
   * Finance: Platform financial transactions
   */
  async getFinanceTransactions(filters?: { limit?: number }) {
    const [payments, walletTxns] = await Promise.all([
      this.prisma.payment.findMany({
        take: filters?.limit || 50,
        include: { order: true },
      }),
      this.prisma.walletTransaction.findMany({
        take: filters?.limit || 50,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, phone: true } } },
      }),
    ]);

    return { payments, walletTxns };
  }

  /**
   * Finance: Rider payouts ledger & pending payouts
   */
  async getRiderPayouts() {
    const riders = await this.prisma.rider.findMany({
      where: { status: 'APPROVED' },
      include: {
        earnings: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return riders.map((r) => {
      const totalEarned = r.earnings.reduce((sum, e) => sum + e.amountInPaise, 0);
      return {
        riderId: r.id,
        name: r.name,
        phone: r.phone,
        bankAccountRef: r.bankAccountRef,
        upiId: r.upiId,
        totalEarnedPaise: totalEarned,
        earningsCount: r.earnings.length,
      };
    });
  }

  /**
   * Finance: Batch process rider payouts
   */
  async processBatchRiderPayouts(riderIds: string[]) {
    const results: {
      riderId: string;
      payoutId: string | null;
      status: string;
      amountInPaise: number;
    }[] = [];

    for (const riderId of riderIds) {
      const rider = await this.prisma.rider.findUnique({ where: { id: riderId } });
      if (!rider) {
        results.push({ riderId, payoutId: null, status: 'RIDER_NOT_FOUND', amountInPaise: 0 });
        continue;
      }

      // The ledger is the source of truth: earnings are positive, previous
      // payouts are negative. Pay out the remaining balance, not a hardcoded 0.
      const earnings = await this.prisma.riderEarning.findMany({
        where: { riderId },
        select: { amountInPaise: true },
      });
      const outstandingPaise = earnings.reduce((sum, e) => sum + e.amountInPaise, 0);

      if (outstandingPaise <= 0) {
        results.push({ riderId, payoutId: null, status: 'NOTHING_DUE', amountInPaise: 0 });
        continue;
      }

      const payout = await this.prisma.riderEarning.create({
        data: {
          riderId,
          type: 'PAYOUT',
          amountInPaise: -outstandingPaise,
        },
      });

      results.push({
        riderId,
        payoutId: payout.id,
        status: 'PROCESSED',
        amountInPaise: outstandingPaise,
      });
    }

    return results;
  }

  /**
   * Finance: Revenue report
   */
  async getRevenueReport() {
    // Revenue has three real sources: gateway money, wallet money, and cash.
    // Wallet refunds are netted out so rejected tickets do not stay in revenue.
    const [orders, refunds] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          finalPaidPaise: true,
          walletAppliedPaise: true,
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

    const byGateway = { RAZORPAY: 0, WALLET: 0, COD: 0 };
    let totalRevenuePaise = 0;
    let totalTransactions = 0;

    for (const order of orders) {
      const { collectedPaise, gateway } = netCollectedPaise(
        order,
        refunds.get(order.id) ?? 0,
      );

      if (collectedPaise > 0) {
        byGateway[gateway] += collectedPaise;
        totalRevenuePaise += collectedPaise;
        totalTransactions += 1;
      }
    }

    return {
      totalRevenuePaise,
      totalTransactions,
      byGateway,
    };
  }

  /**
   * RBAC & Staff Management: List admin and ops staff accounts
   */
  async getStaff() {
    return this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'HUB_MANAGER', 'HUB_STAFF', 'BRAND_OPS'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        adminSubRole: true,
        scopedHubId: true,
        scopedBrandId: true,
        createdAt: true,
      },
    });
  }

  /**
   * RBAC & Staff Management: Create admin or ops staff account
   */
  async createStaff(
    data: {
      name: string;
      email: string;
      phone: string;
      role: string;
      adminSubRole?: string;
      scopedHubId?: string;
      scopedBrandId?: string;
    },
    actorId?: string,
  ) {
    const name = String(data?.name || '').trim();
    const email = String(data?.email || '').trim().toLowerCase();
    const phone = String(data?.phone || '').trim();
    const role = String(data?.role || '').trim();

    if (!name || !email || !phone) {
      throw new BadRequestException('name, email and phone are required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('A valid email address is required');
    }
    if (!/^\+?[0-9]{10,15}$/.test(phone)) {
      throw new BadRequestException('A valid phone number is required');
    }

    const validRoles = ['ADMIN', 'HUB_MANAGER', 'HUB_STAFF', 'BRAND_OPS'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`role must be one of ${validRoles.join(', ')}`);
    }

    const validSubRoles = [
      'SUPER_ADMIN',
      'OPERATIONS_ADMIN',
      'FINANCE_ADMIN',
      'SUPPORT_ADMIN',
      'MARKETING_ADMIN',
    ];

    let adminSubRole: string | null = null;
    let scopedHubId: string | null = null;
    let scopedBrandId: string | null = null;

    if (role === 'ADMIN') {
      const requested = String(data?.adminSubRole || '').trim();
      if (!validSubRoles.includes(requested)) {
        throw new BadRequestException(
          `adminSubRole must be one of ${validSubRoles.join(', ')}`,
        );
      }
      adminSubRole = requested;
    } else if (role === 'HUB_MANAGER' || role === 'HUB_STAFF') {
      if (!data?.scopedHubId) {
        throw new BadRequestException('scopedHubId is required for hub staff');
      }
      const hub = await this.prisma.hub.findUnique({ where: { id: data.scopedHubId } });
      if (!hub) throw new NotFoundException(`Hub ${data.scopedHubId} not found`);
      scopedHubId = data.scopedHubId;
    } else if (role === 'BRAND_OPS') {
      if (!data?.scopedBrandId) {
        throw new BadRequestException('scopedBrandId is required for brand ops');
      }
      const brand = await this.prisma.brand.findUnique({ where: { id: data.scopedBrandId } });
      if (!brand) throw new NotFoundException(`Brand ${data.scopedBrandId} not found`);
      scopedBrandId = data.scopedBrandId;
    }

    const duplicate = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { id: true, email: true, phone: true },
    });
    if (duplicate) {
      throw new ConflictException(
        duplicate.email === email
          ? 'A staff account with this email already exists'
          : 'A staff account with this phone already exists',
      );
    }

    const created = await this.prisma.user.create({
      data: {
        name,
        email,
        phone,
        role,
        adminSubRole: adminSubRole as any,
        scopedHubId,
        scopedBrandId,
        referralCode: `STF_${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'STAFF_CREATED',
        actorId: actorId || 'SYSTEM',
        recordId: created.id,
        diff: { email, phone, role, adminSubRole, scopedHubId, scopedBrandId },
      },
    });

    return created;
  }

  /**
   * Marketing: promotion approval queue.
   *
   * Brand ops create PricingRule rows with config.status = PENDING_ADMIN_APPROVAL.
   * Marketing/super admin review them here; only APPROVED rules are treated as
   * live by the pricing engine.
   */
  async getPromotions() {
    const rules = await this.prisma.pricingRule.findMany({
      orderBy: { startsAt: 'desc' },
      take: 200,
    });

    const brandIds = [...new Set(rules.map((r) => r.brandId).filter(Boolean))] as string[];
    const brands = await this.prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, name: true },
    });
    const brandNameById = new Map(brands.map((b) => [b.id, b.name]));

    return rules.map((rule) => {
      const config = (rule.config as any) || {};
      return {
        ...rule,
        brandName: rule.brandId ? brandNameById.get(rule.brandId) || rule.brandId : 'Platform',
        status: config.status || 'APPROVED',
        proposedAt: config.proposedAt || null,
      };
    });
  }

  async setPromotionStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    actorId?: string,
  ) {
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      throw new BadRequestException('status must be APPROVED or REJECTED');
    }

    const rule = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`Promotion ${id} not found`);

    const config = {
      ...((rule.config as any) || {}),
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: actorId || 'SYSTEM',
    };

    const updated = await this.prisma.pricingRule.update({
      where: { id },
      data: { config },
    });

    await this.prisma.auditLog.create({
      data: {
        action: `PROMOTION_${status}`,
        actorId: actorId || 'SYSTEM',
        recordId: id,
        diff: { brandId: rule.brandId, type: rule.type, status },
      },
    });

    return updated;
  }

  /**
   * Audit Logs: Query system audit logs
   */
  async getAuditLogs(filters?: { action?: string; limit?: number }) {
    const where: any = {};
    if (filters?.action) where.action = filters.action;

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });
  }
}
