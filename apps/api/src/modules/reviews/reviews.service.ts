import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

/**
 * Verified-purchase reviews.
 *
 * There is deliberately no rating column. The storefront shows review text
 * only, so a review can never reintroduce the old fake star average. A review
 * is written once per delivered order and appears publicly only after a human
 * approves it.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    actor: AuthenticatedActor,
    input: { orderId?: string; body?: string },
  ) {
    const orderId = String(input?.orderId || '').trim();
    const body = String(input?.body || '').trim();

    if (!orderId) {
      throw new BadRequestException('An order is required to write a review');
    }
    if (body.length < 10) {
      throw new BadRequestException(
        'Write at least 10 characters so the review is useful to other customers',
      );
    }
    if (body.length > 2000) {
      throw new BadRequestException('A review cannot exceed 2000 characters');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { brandOrders: { select: { brandId: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.userId !== actor?.sub) {
      throw new ForbiddenException('This order does not belong to you');
    }
    if (order.status !== 'DELIVERED') {
      throw new ConflictException(
        'You can review an order after it has been delivered',
      );
    }

    const existing = await this.prisma.review.findUnique({
      where: { orderId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('This order already has a review');
    }

    const brandIds = [
      ...new Set(order.brandOrders.map((brandOrder) => brandOrder.brandId)),
    ];

    return this.prisma.review.create({
      data: {
        orderId,
        userId: actor.sub,
        brandIds,
        body,
        status: 'PENDING',
      },
      select: {
        id: true,
        orderId: true,
        body: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getOrderReview(orderId: string, actor: AuthenticatedActor) {
    const review = await this.prisma.review.findUnique({
      where: { orderId },
      select: {
        id: true,
        orderId: true,
        body: true,
        status: true,
        createdAt: true,
        moderatedAt: true,
      },
    });

    if (!review) return { review: null };

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.userId !== actor?.sub && actor?.role !== 'ADMIN') {
      throw new ForbiddenException('This order does not belong to you');
    }

    return { review };
  }

  /**
   * Public reviews for a brand. Only approved text is returned; the reviewer
   * is never identified beyond "Verified customer".
   */
  async getBrandReviews(slug: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!brand) {
      throw new NotFoundException(`Brand with slug '${slug}' not found`);
    }

    const reviews = await this.prisma.review.findMany({
      where: { status: 'APPROVED', brandIds: { has: brand.id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, body: true, createdAt: true },
    });

    return {
      count: reviews.length,
      reviews: reviews.map((review) => ({
        id: review.id,
        body: review.body,
        createdAt: review.createdAt,
        author: 'Verified customer',
      })),
    };
  }

  /**
   * Moderation queue. Newest first, optionally filtered by status.
   *
   * The reviewer's name and email are included so support can investigate a
   * complaint, but they are never exposed on the public storefront.
   */
  async listForModeration(status?: string) {
    const normalised = String(status || '').trim().toUpperCase();
    const allowed = new Set(['PENDING', 'APPROVED', 'REJECTED']);
    if (normalised && !allowed.has(normalised)) {
      throw new BadRequestException(
        'status must be PENDING, APPROVED or REJECTED',
      );
    }

    const reviews = await this.prisma.review.findMany({
      where: normalised ? { status: normalised as any } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: {
          select: {
            id: true,
            status: true,
            brandOrders: { select: { brandId: true } },
          },
        },
      },
    });

    const brandIds = [
      ...new Set(
        reviews.flatMap(
          (review) => review.order?.brandOrders.map((b) => b.brandId) ?? [],
        ),
      ),
    ];
    const brands = brandIds.length
      ? await this.prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: { id: true, name: true },
        })
      : [];
    const brandNameById = new Map(brands.map((brand) => [brand.id, brand.name]));

    return {
      reviews: reviews.map((review) => ({
        id: review.id,
        orderId: review.orderId,
        body: review.body,
        status: review.status,
        createdAt: review.createdAt,
        moderatedAt: review.moderatedAt,
        customer: review.user
          ? {
              id: review.user.id,
              name: review.user.name,
              email: review.user.email,
            }
          : null,
        brands: [
          ...new Set(
            (review.order?.brandOrders ?? [])
              .map((brandOrder) => brandNameById.get(brandOrder.brandId))
              .filter(Boolean) as string[],
          ),
        ],
      })),
    };
  }

  /**
   * Approve or reject a review.
   *
   * Moderation is one-way: an already-moderated review cannot be flipped,
   * because the public list and the customer's "published" state would then
   * disagree with the audit record. A rejected review stays visible to its
   * author with an honest status.
   */
  async moderateReview(
    id: string,
    actor: AuthenticatedActor,
    input: { status?: string; note?: string },
  ) {
    const status = String(input?.status || '').trim().toUpperCase();
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      throw new BadRequestException('status must be APPROVED or REJECTED');
    }

    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!review) {
      throw new NotFoundException(`Review ${id} not found`);
    }
    if (review.status !== 'PENDING') {
      throw new ConflictException(
        `This review was already ${review.status.toLowerCase()}`,
      );
    }

    const note = String(input?.note || '').trim();
    if (note.length > 500) {
      throw new BadRequestException('A moderation note cannot exceed 500 characters');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.review.update({
        where: { id },
        data: {
          status: status as any,
          moderatedById: actor.sub,
          moderatedAt: new Date(),
        },
        select: {
          id: true,
          orderId: true,
          status: true,
          moderatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: `REVIEW_${status}`,
          actorId: actor.sub,
          recordId: id,
          diff: {
            previousStatus: review.status,
            status,
            note: note || null,
          },
        },
      });

      return result;
    });

    return updated;
  }
}
