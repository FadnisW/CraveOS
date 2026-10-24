import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sum of wallet refunds already issued per order.
   *
   * A rejected brand ticket credits the customer's wallet but leaves the order
   * alive. Without netting those credits out, the same money is counted as
   * revenue twice: once on the original order, then again when the customer
   * spends the refund.
   */
  private async getRefundsByOrder(): Promise<Map<string, number>> {
    const rows = await this.prisma.walletTransaction.groupBy({
      by: ['orderId'],
      where: {
        orderId: { not: null },
        reason: { in: ['ORDER_REFUND', 'PARTIAL_ORDER_REFUND'] },
      },
      _sum: { amountInPaise: true },
    });

    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.orderId) map.set(row.orderId, row._sum.amountInPaise ?? 0);
    }
    return map;
  }

  /**
   * Money actually collected for an order, net of wallet refunds.
   *
   *  - A successful gateway payment covers `amountInPaise` plus the wallet
   *    portion reserved at checkout.
   *  - A synthetic `wallet` payment covers the whole bill from wallet credit
   *    (this includes orders the customer started as UPI but wallet covered).
   *  - COD has no payment row: only the wallet portion is collected up front,
   *    and the cash arrives on delivery.
   */
  private netCollectedPaise(
    order: {
      status: string;
      paymentMethod: string;
      finalPaidPaise: number;
      walletAppliedPaise: number;
      payment?: { status: string; amountInPaise: number; gateway: string } | null;
    },
    refundedPaise = 0,
  ): { collectedPaise: number; gateway: 'RAZORPAY' | 'WALLET' | 'COD' } {
    let grossPaise = 0;
    let gateway: 'RAZORPAY' | 'WALLET' | 'COD' = 'RAZORPAY';

    if (order.payment?.status === 'SUCCESS') {
      if (order.payment.gateway === 'wallet') {
        gateway = 'WALLET';
        grossPaise = order.payment.amountInPaise;
      } else {
        gateway = 'RAZORPAY';
        grossPaise = order.payment.amountInPaise + order.walletAppliedPaise;
      }
    } else if (order.paymentMethod === 'COD') {
      gateway = 'COD';
      grossPaise =
        order.walletAppliedPaise +
        (order.status === 'DELIVERED' ? order.finalPaidPaise : 0);
    }

    return { collectedPaise: Math.max(0, grossPaise - refundedPaise), gateway };
  }

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
   * Atomically adjust user wallet balance and append transaction record
   */
  async adjustWallet(userId: string, amountInPaise: number, reason: string) {
    const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          walletBalance: {
            increment: amountInPaise,
          },
        },
      });

      const txn = await tx.walletTransaction.create({
        data: {
          userId,
          amountInPaise,
          reason,
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
          payment: { select: { status: true, amountInPaise: true, gateway: true } },
          brandOrders: {
            select: {
              brandId: true,
              status: true,
              items: { select: { priceSnapshot: true, quantity: true } },
            },
          },
        },
      }),
      this.getRefundsByOrder(),
    ]);

    const brandMap: Record<string, { count: number; revenue: number }> = {};
    const hubMap: Record<string, { count: number; revenue: number }> = {};

    for (const order of orders) {
      const { collectedPaise } = this.netCollectedPaise(order, refunds.get(order.id) ?? 0);

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
  private localDayKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

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
          payment: { select: { status: true, amountInPaise: true, gateway: true } },
        },
      }),
      this.getRefundsByOrder(),
    ]);

    const days: { date: string; revenuePaise: number; orderCount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const dayKey = this.localDayKey(d);
      const dayOrders = orders.filter(
        (order) => this.localDayKey(order.createdAt) === dayKey,
      );

      let revenuePaise = 0;
      let orderCount = 0;
      for (const order of dayOrders) {
        const { collectedPaise } = this.netCollectedPaise(order, refunds.get(order.id) ?? 0);
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
    return this.prisma.hub.create({
      data: {
        name: data.name,
        city: data.city,
        lat: data.lat,
        lng: data.lng,
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

    return this.prisma.hub.update({
      where: { id },
      data,
    });
  }

  /**
   * Hub Management: Assign staff to hub
   */
  async assignStaffToHub(hubId: string, userId: string, role: 'HUB_STAFF' | 'HUB_MANAGER') {
    const hub = await this.prisma.hub.findUnique({ where: { id: hubId } });
    if (!hub) throw new NotFoundException(`Hub ${hubId} not found`);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        role,
        scopedHubId: hubId,
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

    return this.prisma.brand.update({
      where: { id },
      data,
    });
  }

  /**
   * Brand Management: Assign brand ops manager
   */
  async assignBrandOps(brandId: string, userId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException(`Brand ${brandId} not found`);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'BRAND_OPS',
        scopedBrandId: brandId,
      },
    });
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
          payment: { select: { status: true, amountInPaise: true, gateway: true } },
        },
      }),
      this.getRefundsByOrder(),
    ]);

    const byGateway = { RAZORPAY: 0, WALLET: 0, COD: 0 };
    let totalRevenuePaise = 0;
    let totalTransactions = 0;

    for (const order of orders) {
      const { collectedPaise, gateway } = this.netCollectedPaise(
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
  async createStaff(data: {
    name: string;
    email: string;
    phone: string;
    role: string;
    adminSubRole?: any;
    scopedHubId?: string;
    scopedBrandId?: string;
  }) {
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        adminSubRole: data.adminSubRole || null,
        scopedHubId: data.scopedHubId || null,
        scopedBrandId: data.scopedBrandId || null,
        referralCode: `STF_${Date.now().toString(36).toUpperCase()}`,
      },
    });
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
