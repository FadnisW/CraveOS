import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PromotionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Base delivery and packaging fees in paise. Members pay neither. */
const DELIVERY_FEE_PAISE = 4500;
const PACKAGING_FEE_PAISE = 2500;

/** GST: restaurant food/packaging is 5%, delivery is a separate 18% service. */
const FOOD_GST_RATE = 0.05;
const DELIVERY_GST_RATE = 0.18;

export interface QuoteOptionInput {
  /** `variant` for a size, `addons` for an extra. */
  groupId: string;
  optionName: string;
}

export interface QuoteItemInput {
  menuItemId: string;
  quantity: number;
  options?: QuoteOptionInput[];
}

export interface QuoteInput {
  userId: string;
  addressId?: string;
  hubId?: string;
  items: QuoteItemInput[];
  couponCode?: string;
  useWalletBalancePaise?: number;
  /** Serialise redemptions for one promotion inside the order transaction. */
  lockPromotion?: boolean;
}

interface CatalogueOption {
  name: string;
  priceInPaise: number;
}

interface ResolvedOption {
  groupId: 'variant' | 'addons';
  groupTitle: string;
  name: string;
  priceInPaise: number;
}

interface ResolvedLine {
  menuItemId: string;
  brandId: string;
  name: string;
  mrpInPaise: number;
  memberPriceInPaise: number;
  quantity: number;
  options: ResolvedOption[];
}

interface AppliedPromotion {
  applied: true;
  promotionId: string;
  code: string;
  name: string;
  type: PromotionType;
  discountPaise: number;
}

interface RejectedPromotion {
  applied: false;
  code: string;
  reason: string;
  message: string;
}

type PromotionEvaluation = AppliedPromotion | RejectedPromotion | null;

export interface QuoteResult {
  currency: 'INR';
  hubId: string;
  addressId: string | null;
  isMember: boolean;
  membership: {
    planId: string;
    planName: string;
    status: string;
    endsAt: string;
  } | null;
  lines: {
    menuItemId: string;
    brandId: string;
    name: string;
    mrpInPaise: number;
    memberPriceInPaise: number;
    quantity: number;
    options: ResolvedOption[];
    lineTotalPaise: number;
    memberLineTotalPaise: number;
  }[];
  amounts: {
    itemTotalPaise: number;
    memberDiscountPaise: number;
    couponDiscountPaise: number;
    foodDiscountPaise: number;
    deliveryDiscountPaise: number;
    deliveryFeePaise: number;
    packagingFeePaise: number;
    foodTaxPaise: number;
    deliveryTaxPaise: number;
    taxPaise: number;
    grossTotalPaise: number;
    walletAppliedPaise: number;
    finalPayablePaise: number;
  };
  coupon: {
    code: string | null;
    applied: boolean;
    invalid: boolean;
    reason: string | null;
    message: string | null;
    promotionId: string | null;
    name: string | null;
    discountPaise: number;
  } | null;
  walletBalancePaise: number | null;

  // Rupee mirrors kept for the storefront. All arithmetic above is in paise.
  itemTotal: number;
  memberDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  couponApplied: boolean;
  couponInvalid: boolean;
  couponMessage: string | null;
  deliveryFee: number;
  packagingFee: number;
  taxes: number;
  grossTotal: number;
  walletBalanceRupees: number | null;
  walletApplied: number;
  finalPayable: number;
  savingsSummary: {
    memberDiscountSaved: number;
    deliverySaved: number;
    packagingSaved: number;
    couponDiscount: number;
    totalSaved: number;
  };
  prospectiveSavings: {
    memberDiscountSaved: number;
    deliverySaved: number;
    packagingSaved: number;
    totalSaved: number;
  };
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The single source of truth for a cart total.
   *
   * The client sends menu item ids and quantities only. Every price, fee, tax,
   * membership benefit and promotion comes from PostgreSQL. The same method is
   * called by the checkout quote endpoint and by order creation (inside the
   * order transaction), so the amount shown and the amount charged cannot
   * diverge.
   */
  async quote(
    input: QuoteInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<QuoteResult> {
    const userId = String(input?.userId || '').trim();
    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const now = new Date();
    const { hubId, addressId } = await this.resolveHub(db, userId, input);
    const lines = await this.resolveLines(db, input.items, hubId);
    const membership = await db.membership.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const isMember =
      !!membership &&
      ['TRIAL', 'ACTIVE'].includes(membership.status) &&
      membership.endsAt > now;

    const itemTotalPaise = lines.reduce(
      (sum, line) => sum + line.mrpInPaise * line.quantity,
      0,
    );
    const memberItemTotalPaise = lines.reduce(
      (sum, line) => sum + line.memberPriceInPaise * line.quantity,
      0,
    );
    const memberDiscountPaise = isMember
      ? Math.max(0, itemTotalPaise - memberItemTotalPaise)
      : 0;
    const payableItemSubtotalPaise = itemTotalPaise - memberDiscountPaise;

    const deliveryFeePaise = isMember ? 0 : DELIVERY_FEE_PAISE;
    const packagingFeePaise = isMember ? 0 : PACKAGING_FEE_PAISE;

    const promotion = await this.evaluatePromotion(
      db,
      {
        code: input.couponCode,
        userId,
        hubId,
        lines,
        isMember,
        itemTotalPaise,
        deliveryFeePaise,
        now,
        lock: !!input.lockPromotion,
      },
    );

    const couponDiscountPaise = promotion?.applied ? promotion.discountPaise : 0;
    const foodDiscountPaise =
      promotion?.applied && promotion.type !== 'FREE_DELIVERY'
        ? couponDiscountPaise
        : 0;
    const deliveryDiscountPaise =
      promotion?.applied && promotion.type === 'FREE_DELIVERY'
        ? couponDiscountPaise
        : 0;

    const foodSubtotalPaise = Math.max(
      0,
      payableItemSubtotalPaise - foodDiscountPaise,
    );
    const deliverySubtotalPaise = Math.max(
      0,
      deliveryFeePaise - deliveryDiscountPaise,
    );

    // GST is computed on the discounted amounts, never on the pre-discount
    // total. Rounding happens once per component and then sums to the total.
    const foodTaxPaise = Math.round(foodSubtotalPaise * FOOD_GST_RATE);
    const deliveryTaxPaise = Math.round(
      deliverySubtotalPaise * DELIVERY_GST_RATE,
    );
    const packagingTaxPaise = Math.round(
      packagingFeePaise * FOOD_GST_RATE,
    );
    const taxPaise = foodTaxPaise + deliveryTaxPaise + packagingTaxPaise;
    const grossTotalPaise =
      foodSubtotalPaise +
      deliverySubtotalPaise +
      packagingFeePaise +
      taxPaise;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });
    if (!user) {
      throw new UnauthorizedUserException();
    }

    const requestedWallet = Math.max(
      0,
      Math.floor(Number(input.useWalletBalancePaise) || 0),
    );
    const walletAppliedPaise = Math.min(
      requestedWallet,
      user.walletBalance,
      grossTotalPaise,
    );
    const finalPayablePaise = Math.max(
      0,
      grossTotalPaise - walletAppliedPaise,
    );

    const coupon = this.serializeCoupon(input.couponCode, promotion);
    const deliverySavedPaise = isMember ? DELIVERY_FEE_PAISE : 0;
    const packagingSavedPaise = isMember ? PACKAGING_FEE_PAISE : 0;

    return {
      currency: 'INR',
      hubId,
      addressId,
      isMember,
      membership: membership
        ? {
            planId: membership.planId,
            planName: membership.plan?.name || membership.planId,
            status: membership.status,
            endsAt: membership.endsAt.toISOString(),
          }
        : null,
      lines: lines.map((line) => ({
        ...line,
        lineTotalPaise: line.mrpInPaise * line.quantity,
        memberLineTotalPaise: line.memberPriceInPaise * line.quantity,
      })),
      amounts: {
        itemTotalPaise,
        memberDiscountPaise,
        couponDiscountPaise,
        foodDiscountPaise,
        deliveryDiscountPaise,
        deliveryFeePaise,
        packagingFeePaise,
        foodTaxPaise,
        deliveryTaxPaise,
        taxPaise,
        grossTotalPaise,
        walletAppliedPaise,
        finalPayablePaise,
      },
      coupon,
      walletBalancePaise: user.walletBalance,

      itemTotal: itemTotalPaise / 100,
      memberDiscount: memberDiscountPaise / 100,
      couponCode: coupon?.code || null,
      couponDiscount: couponDiscountPaise / 100,
      couponApplied: !!coupon?.applied,
      couponInvalid: !!coupon?.invalid,
      couponMessage: coupon?.message || null,
      deliveryFee: deliveryFeePaise / 100,
      packagingFee: packagingFeePaise / 100,
      taxes: taxPaise / 100,
      grossTotal: grossTotalPaise / 100,
      walletBalanceRupees: user.walletBalance / 100,
      walletApplied: walletAppliedPaise / 100,
      finalPayable: finalPayablePaise / 100,
      savingsSummary: {
        memberDiscountSaved: memberDiscountPaise / 100,
        deliverySaved: deliverySavedPaise / 100,
        packagingSaved: packagingSavedPaise / 100,
        couponDiscount: couponDiscountPaise / 100,
        totalSaved:
          (memberDiscountPaise +
            deliverySavedPaise +
            packagingSavedPaise +
            couponDiscountPaise) /
          100,
      },
      prospectiveSavings: {
        memberDiscountSaved:
          Math.max(0, itemTotalPaise - memberItemTotalPaise) / 100,
        deliverySaved: DELIVERY_FEE_PAISE / 100,
        packagingSaved: PACKAGING_FEE_PAISE / 100,
        totalSaved:
          (Math.max(0, itemTotalPaise - memberItemTotalPaise) +
            DELIVERY_FEE_PAISE +
            PACKAGING_FEE_PAISE) /
          100,
      },
    };
  }

  /**
   * Verifies a membership against the database. A membership only counts while
   * it is TRIAL or ACTIVE and its single expiry timestamp is in the future.
   */
  async verifyMembership(userId?: string): Promise<boolean> {
    if (!userId) return false;

    const membership = await this.prisma.membership.findUnique({
      where: { userId },
      select: { status: true, endsAt: true },
    });

    return (
      !!membership &&
      ['TRIAL', 'ACTIVE'].includes(membership.status) &&
      membership.endsAt > new Date()
    );
  }

  private async resolveHub(
    db: Prisma.TransactionClient,
    userId: string,
    input: QuoteInput,
  ): Promise<{ hubId: string; addressId: string | null }> {
    if (input.addressId) {
      const address = await db.address.findUnique({
        where: { id: input.addressId },
      });

      if (!address) {
        throw new NotFoundException('Delivery address not found');
      }
      if (address.userId !== userId) {
        throw new ForbiddenException('This delivery address does not belong to you');
      }
      if (!address.resolvedHubId) {
        throw new BadRequestException(
          'This address is not inside a serviceable delivery hub',
        );
      }
      if (input.hubId && input.hubId !== address.resolvedHubId) {
        throw new ConflictException(
          'The selected hub does not serve this delivery address',
        );
      }

      const hub = await db.hub.findUnique({
        where: { id: address.resolvedHubId },
        select: { id: true },
      });
      if (!hub) {
        throw new BadRequestException(
          'The delivery hub for this address is no longer available',
        );
      }

      return { hubId: address.resolvedHubId, addressId: address.id };
    }

    if (!input.hubId) {
      throw new BadRequestException(
        'An addressId or hubId is required to calculate a delivery total',
      );
    }

    const hub = await db.hub.findUnique({
      where: { id: input.hubId },
      select: { id: true },
    });
    if (!hub) {
      throw new BadRequestException('The selected hub does not exist');
    }

    return { hubId: input.hubId, addressId: null };
  }

  /**
   * Reads a `variants`/`addOns` JSON column into a validated list.
   *
   * Catalogue rows are operator-edited data, so a malformed entry is skipped
   * rather than crashing checkout. A skipped variant will then surface as
   * "choose a valid size" instead of silently charging the base price.
   */
  private parseCatalogueOptions(value: Prisma.JsonValue | null): CatalogueOption[] {
    if (!Array.isArray(value)) return [];

    const options: CatalogueOption[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const name = String((entry as any).name || '').trim();
      const priceInPaise = Number((entry as any).priceInPaise);
      if (!name || !Number.isInteger(priceInPaise) || priceInPaise < 0) continue;
      options.push({ name, priceInPaise });
    }
    return options;
  }

  private normaliseOptionName(value: string) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Resolves the cart to database rows served by the selected hub.
   *
   * A cart may contain the copy of an item owned by another kitchen of the same
   * brand. That logical item is resolved to the copy served by this hub.
   *
   * Variant pricing rule (agreed with the business):
   *  - A selected size *replaces* the item's base price.
   *  - The member price keeps the item's fixed rupee discount
   *    (base MRP - base member price), floored at zero.
   *  - Add-ons add their price to both the MRP and the member price.
   *
   * Lines are keyed by item + resolved options so two sizes of the same pizza
   * remain two order lines with the correct price each.
   */
  private async resolveLines(
    db: Prisma.TransactionClient,
    items: QuoteItemInput[],
    hubId: string,
  ): Promise<ResolvedLine[]> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    interface RequestedLine {
      menuItemId: string;
      quantity: number;
      options: QuoteOptionInput[];
    }

    const requestedLines: RequestedLine[] = [];
    const requestedQty = new Map<string, number>();

    for (const item of items) {
      const menuItemId = String(item?.menuItemId || '').trim();
      if (!menuItemId) {
        throw new BadRequestException('Every cart line needs a menuItemId');
      }

      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException('Quantity must be a positive whole number');
      }
      if (quantity > 50) {
        throw new BadRequestException('Quantity per item cannot exceed 50');
      }

      const rawOptions = Array.isArray(item.options) ? item.options : [];
      const options: QuoteOptionInput[] = [];
      const seenOptions = new Set<string>();

      for (const option of rawOptions) {
        const groupId = String(option?.groupId || '').trim();
        const optionName = String(option?.optionName || '').trim();

        if (!groupId || !optionName) {
          throw new BadRequestException(
            'Every selected option needs a groupId and optionName',
          );
        }
        if (groupId !== 'variant' && groupId !== 'addons') {
          throw new BadRequestException(
            `Unknown option group '${groupId}'.`,
          );
        }
        if (groupId === 'variant' && options.some((entry) => entry.groupId === 'variant')) {
          throw new BadRequestException('Choose only one size per item');
        }

        const signature = `${groupId}:${this.normaliseOptionName(optionName)}`;
        if (seenOptions.has(signature)) {
          throw new BadRequestException(
            `'${optionName}' was selected twice for the same item.`,
          );
        }
        seenOptions.add(signature);
        options.push({ groupId, optionName });
      }

      requestedLines.push({ menuItemId, quantity, options });
      requestedQty.set(
        menuItemId,
        (requestedQty.get(menuItemId) || 0) + quantity,
      );
    }

    const menuItemIds = [...requestedQty.keys()];
    const dbItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: { brandKitchen: true },
    });

    const groupIds = [
      ...new Set(
        dbItems
          .map((item) => item.menuItemGroupId)
          .filter((groupId): groupId is string => !!groupId),
      ),
    ];
    const hubCopies = groupIds.length
      ? await db.menuItem.findMany({
          where: {
            menuItemGroupId: { in: groupIds },
            brandKitchen: { hubId },
          },
          include: { brandKitchen: true },
        })
      : [];
    const copyByGroup = new Map(
      hubCopies.map((item) => [item.menuItemGroupId as string, item]),
    );

    const resolvedByKey = new Map<string, ResolvedLine>();

    for (const requestedLine of requestedLines) {
      const requested = dbItems.find(
        (item) => item.id === requestedLine.menuItemId,
      );
      if (!requested) {
        throw new BadRequestException(
          'A cart item is no longer on the menu. Please refresh your cart.',
        );
      }

      const dbItem =
        requested.brandKitchen.hubId === hubId
          ? requested
          : requested.menuItemGroupId
            ? copyByGroup.get(requested.menuItemGroupId)
            : undefined;

      if (!dbItem || !dbItem.brandKitchen) {
        throw new BadRequestException(
          `Cross-Hub Conflict: '${requested.name}' is not served from the selected hub.`,
        );
      }
      if (!dbItem.isAvailable) {
        throw new ConflictException(
          `'${dbItem.name}' is currently out of stock (86'd).`,
        );
      }

      const variants = this.parseCatalogueOptions(dbItem.variants);
      const addOns = this.parseCatalogueOptions(dbItem.addOns);
      const variantInputs = requestedLine.options.filter(
        (option) => option.groupId === 'variant',
      );
      const addOnInputs = requestedLine.options.filter(
        (option) => option.groupId === 'addons',
      );

      if (variants.length > 0 && variantInputs.length === 0) {
        throw new BadRequestException(
          `Choose a size for '${dbItem.name}' before adding it to the cart.`,
        );
      }
      if (variants.length === 0 && variantInputs.length > 0) {
        throw new BadRequestException(
          `'${dbItem.name}' does not have sizes to choose from.`,
        );
      }

      let variant: CatalogueOption | undefined;
      if (variantInputs.length > 0) {
        const requestedName = this.normaliseOptionName(
          variantInputs[0].optionName,
        );
        variant = variants.find(
          (entry) => this.normaliseOptionName(entry.name) === requestedName,
        );
        if (!variant) {
          throw new BadRequestException(
            `'${variantInputs[0].optionName}' is not a valid size for '${dbItem.name}'.`,
          );
        }
      }

      const selectedAddOns: CatalogueOption[] = [];
      for (const input of addOnInputs) {
        const requestedName = this.normaliseOptionName(input.optionName);
        const match = addOns.find(
          (entry) => this.normaliseOptionName(entry.name) === requestedName,
        );
        if (!match) {
          throw new BadRequestException(
            `'${input.optionName}' is not an available extra for '${dbItem.name}'.`,
          );
        }
        selectedAddOns.push(match);
      }

      // A size is the item's price, not a surcharge. Add-ons are surcharges.
      const variantBaseMrp = variant?.priceInPaise ?? dbItem.mrpInPaise;
      const baseMemberPrice = Math.min(
        dbItem.memberPriceInPaise,
        dbItem.mrpInPaise,
      );
      const fixedMemberDiscount = Math.max(
        0,
        dbItem.mrpInPaise - baseMemberPrice,
      );
      const addOnTotal = selectedAddOns.reduce(
        (sum, entry) => sum + entry.priceInPaise,
        0,
      );
      const mrpInPaise = variantBaseMrp + addOnTotal;
      const memberPriceInPaise = Math.min(
        mrpInPaise,
        Math.max(0, variantBaseMrp - fixedMemberDiscount) + addOnTotal,
      );

      const options: ResolvedOption[] = [
        ...(variant
          ? [
              {
                groupId: 'variant' as const,
                groupTitle: 'Size',
                name: variant.name,
                priceInPaise: variant.priceInPaise,
              },
            ]
          : []),
        ...selectedAddOns.map((entry) => ({
          groupId: 'addons' as const,
          groupTitle: 'Extra',
          name: entry.name,
          priceInPaise: entry.priceInPaise,
        })),
      ];

      const lineKey = `${dbItem.id}::${options
        .map(
          (entry) =>
            `${entry.groupId}:${this.normaliseOptionName(entry.name)}`,
        )
        .sort()
        .join('|')}`;

      const existing = resolvedByKey.get(lineKey);
      if (existing) {
        existing.quantity += requestedLine.quantity;
        continue;
      }

      resolvedByKey.set(lineKey, {
        menuItemId: dbItem.id,
        brandId: dbItem.brandKitchen.brandId,
        name: dbItem.name,
        mrpInPaise,
        // Defensive: a bad catalogue row must never make the member price exceed MRP.
        memberPriceInPaise,
        quantity: requestedLine.quantity,
        options,
      });
    }

    return [...resolvedByKey.values()];
  }

  private async evaluatePromotion(
    db: Prisma.TransactionClient,
    input: {
      code?: string;
      userId: string;
      hubId: string;
      lines: ResolvedLine[];
      isMember: boolean;
      itemTotalPaise: number;
      deliveryFeePaise: number;
      now: Date;
      lock: boolean;
    },
  ): Promise<PromotionEvaluation> {
    const code = String(input.code || '').trim().toUpperCase();
    if (!code) return null;

    const promotion = await db.promotion.findUnique({ where: { code } });
    if (!promotion) {
      return this.reject(code, 'UNKNOWN_CODE', `Coupon '${code}' does not exist.`);
    }

    if (promotion.status !== 'APPROVED') {
      return this.reject(
        code,
        'NOT_ACTIVE',
        `Coupon '${code}' is not available.`,
      );
    }

    if (input.now < promotion.startsAt) {
      return this.reject(
        code,
        'NOT_STARTED',
        `Coupon '${code}' is not active yet.`,
      );
    }

    if (input.now >= promotion.endsAt) {
      return this.reject(code, 'EXPIRED', `Coupon '${code}' has expired.`);
    }

    if (promotion.hubId && promotion.hubId !== input.hubId) {
      return this.reject(
        code,
        'WRONG_HUB',
        `Coupon '${code}' is not valid for this delivery hub.`,
      );
    }

    const eligibleLines = promotion.brandId
      ? input.lines.filter((line) => line.brandId === promotion.brandId)
      : input.lines;

    if (eligibleLines.length === 0) {
      return this.reject(
        code,
        'WRONG_BRAND',
        `Coupon '${code}' is not valid for the items in this cart.`,
      );
    }

    const eligibleBasePaise = eligibleLines.reduce(
      (sum, line) =>
        sum +
        (input.isMember ? line.memberPriceInPaise : line.mrpInPaise) *
          line.quantity,
      0,
    );

    if (eligibleBasePaise < promotion.minOrderPaise) {
      return this.reject(
        code,
        'MIN_ORDER',
        `Coupon '${code}' needs an item subtotal of at least ₹${(
          promotion.minOrderPaise / 100
        ).toFixed(0)}.`,
      );
    }

    if (promotion.firstOrderOnly) {
      const priorOrders = await db.order.count({
        where: {
          userId: input.userId,
          status: { not: 'CANCELLED' },
        },
      });
      if (priorOrders > 0) {
        return this.reject(
          code,
          'FIRST_ORDER_ONLY',
          `Coupon '${code}' is only valid on your first order.`,
        );
      }
    }

    // Serialise concurrent redemptions before counting them. Without this lock
    // two checkouts can both read "one use left" and both redeem.
    if (input.lock) {
      await db.$queryRaw`SELECT "id" FROM "promotions" WHERE "id" = ${promotion.id} FOR UPDATE`;
    }

    if (promotion.totalUsageLimit !== null) {
      const totalRedemptions = await db.promotionRedemption.count({
        where: { promotionId: promotion.id },
      });
      if (totalRedemptions >= promotion.totalUsageLimit) {
        return this.reject(
          code,
          'USAGE_LIMIT_REACHED',
          `Coupon '${code}' has reached its usage limit.`,
        );
      }
    }

    const userRedemptions = await db.promotionRedemption.count({
      where: { promotionId: promotion.id, userId: input.userId },
    });
    if (userRedemptions >= promotion.perUserLimit) {
      return this.reject(
        code,
        'USER_LIMIT_REACHED',
        `You have already used coupon '${code}'.`,
      );
    }

    let discountPaise = 0;
    if (promotion.type === 'PERCENT') {
      discountPaise = Math.floor(
        (eligibleBasePaise * promotion.value) / 100,
      );
    } else if (promotion.type === 'FLAT') {
      discountPaise = promotion.value;
    } else if (promotion.type === 'FREE_DELIVERY') {
      discountPaise = input.deliveryFeePaise;
    }

    if (promotion.maxDiscountPaise !== null) {
      discountPaise = Math.min(discountPaise, promotion.maxDiscountPaise);
    }
    // A free-delivery code discounts the delivery fee, not the food subtotal.
    discountPaise = Math.min(
      discountPaise,
      promotion.type === 'FREE_DELIVERY'
        ? input.deliveryFeePaise
        : eligibleBasePaise,
    );

    if (discountPaise <= 0) {
      return this.reject(
        code,
        'NO_BENEFIT',
        promotion.type === 'FREE_DELIVERY'
          ? `Coupon '${code}' is not needed — this order already has free delivery.`
          : `Coupon '${code}' gives no discount on this cart.`,
      );
    }

    return {
      applied: true,
      promotionId: promotion.id,
      code: promotion.code,
      name: promotion.name,
      type: promotion.type,
      discountPaise,
    };
  }

  private reject(
    code: string,
    reason: string,
    message: string,
  ): RejectedPromotion {
    return { applied: false, code, reason, message };
  }

  private serializeCoupon(
    requestedCode: string | undefined,
    promotion: PromotionEvaluation,
  ): QuoteResult['coupon'] {
    const code = String(requestedCode || '').trim().toUpperCase();
    if (!code) return null;

    if (promotion?.applied) {
      return {
        code: promotion.code,
        applied: true,
        invalid: false,
        reason: null,
        message: null,
        promotionId: promotion.promotionId,
        name: promotion.name,
        discountPaise: promotion.discountPaise,
      };
    }

    return {
      code,
      applied: false,
      invalid: true,
      reason: promotion?.reason || 'UNKNOWN_CODE',
      message: promotion?.message || `Coupon '${code}' is not valid for this cart.`,
      promotionId: null,
      name: null,
      discountPaise: 0,
    };
  }

  // Cache store for active offers (60-second TTL to avoid hammering the database)
  private offersCache: { data: unknown; expiresAt: number } | null = null;

  /**
   * Approved, in-window promotions. Returns only customer-facing fields: no
   * usage counters, reviewer identity or internal status history.
   */
  async getActiveOffers() {
    const nowMs = Date.now();
    if (this.offersCache && this.offersCache.expiresAt > nowMs) {
      return this.offersCache.data;
    }

    const now = new Date();
    const rules = await this.prisma.promotion.findMany({
      where: {
        status: 'APPROVED',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: [{ endsAt: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        type: true,
        value: true,
        minOrderPaise: true,
        maxDiscountPaise: true,
        firstOrderOnly: true,
        perUserLimit: true,
        startsAt: true,
        endsAt: true,
      },
    });

    const result = { offers: rules };
    this.offersCache = { data: result, expiresAt: nowMs + 60000 };
    return result;
  }
}

/**
 * A quote can only be produced for an authenticated account that still exists.
 * Kept private so the public quote endpoint never reveals which ids are valid.
 */
class UnauthorizedUserException extends ForbiddenException {
  constructor() {
    super('Authentication required');
  }
}
