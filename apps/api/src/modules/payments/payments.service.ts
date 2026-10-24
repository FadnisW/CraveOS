import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: any;
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor(private readonly prisma: PrismaService) {
    // No hardcoded fallbacks: shipping a test key in source is a credential leak.
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (!this.keyId || !this.keySecret) {
      this.logger.error(
        'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured — payment creation will fail.',
      );
      this.razorpay = null;
    } else {
      this.razorpay = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    }
  }

  /**
   * Creates (or reuses) a Razorpay order for an existing CraveOS order.
   *
   * The amount always comes from `Order.finalPaidPaise` — never from the client.
   */
  async createRazorpayOrder(orderId: string, actor: AuthenticatedActor) {
    if (!orderId) {
      throw new BadRequestException('orderId is required');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (actor?.role !== 'ADMIN' && order.userId !== actor?.sub) {
      throw new ForbiddenException('You can only pay for your own orders');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('This order has been cancelled');
    }

    if (order.payment?.status === 'SUCCESS') {
      throw new ConflictException('This order has already been paid');
    }

    if (order.finalPaidPaise <= 0) {
      throw new BadRequestException(
        'This order has no gateway balance due — it is already settled by wallet or cash on delivery.',
      );
    }

    if (!this.razorpay) {
      throw new InternalServerErrorException('Payment gateway is not configured');
    }

    // Reuse an in-flight gateway order when the amount has not changed, so
    // re-opening the checkout modal does not create a new Razorpay order each time.
    if (
      order.payment?.gatewayOrderId &&
      order.payment.status === 'INITIATED' &&
      order.payment.amountInPaise === order.finalPaidPaise
    ) {
      return {
        razorpayOrderId: order.payment.gatewayOrderId,
        amount: order.finalPaidPaise,
        currency: 'INR',
        key: this.keyId,
      };
    }

    try {
      const razorpayOrder = await this.razorpay.orders.create({
        amount: order.finalPaidPaise,
        currency: 'INR',
        receipt: `receipt_${orderId.substring(0, 30)}`,
        notes: { orderId },
      });

      await this.prisma.payment.upsert({
        where: { orderId },
        update: {
          gateway: 'razorpay',
          gatewayOrderId: razorpayOrder.id,
          amountInPaise: order.finalPaidPaise,
          status: 'INITIATED',
        },
        create: {
          orderId,
          gateway: 'razorpay',
          gatewayOrderId: razorpayOrder.id,
          amountInPaise: order.finalPaidPaise,
          status: 'INITIATED',
        },
      });

      this.logger.log(
        `💳 Razorpay order ${razorpayOrder.id} created for ₹${order.finalPaidPaise / 100} (order ${orderId})`,
      );

      return {
        razorpayOrderId: razorpayOrder.id,
        amount: order.finalPaidPaise,
        currency: 'INR',
        key: this.keyId,
      };
    } catch (error: any) {
      this.logger.error('Failed to create Razorpay order:', error);
      throw new InternalServerErrorException(error.message || 'Razorpay order creation failed');
    }
  }

  /**
   * Verifies the Razorpay checkout callback signature and settles the order.
   * This is the client-side counterpart to the webhook: whichever arrives first wins.
   */
  async verifyPayment(
    input: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    },
    actor: AuthenticatedActor,
  ) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new BadRequestException(
        'razorpay_order_id, razorpay_payment_id and razorpay_signature are required',
      );
    }

    if (!this.keySecret) {
      throw new InternalServerErrorException('Payment gateway is not configured');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { gatewayOrderId: razorpay_order_id },
      include: { order: { select: { id: true, userId: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Unknown payment for this gateway order');
    }

    if (actor?.role !== 'ADMIN' && payment.order.userId !== actor?.sub) {
      throw new ForbiddenException('You can only verify your own payments');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (!this.signaturesMatch(expectedSignature, razorpay_signature)) {
      this.logger.error(`❌ Invalid Razorpay signature for gateway order ${razorpay_order_id}`);
      throw new BadRequestException('Invalid payment signature');
    }

    const result = await this.markPaymentSuccess(razorpay_order_id, razorpay_payment_id);

    return {
      status: 'SUCCESS',
      orderId: payment.orderId,
      alreadyProcessed: !!result?.alreadyProcessed,
    };
  }

  /**
   * Idempotent settlement used by both the webhook and the client verification endpoint.
   */
  async markPaymentSuccess(gatewayOrderId: string, gatewayPaymentId?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayOrderId },
      include: { order: true },
    });

    if (!payment) {
      this.logger.warn(`Received payment success for unknown gateway order ${gatewayOrderId}`);
      return null;
    }

    if (payment.status === 'SUCCESS') {
      return { alreadyProcessed: true, orderId: payment.orderId };
    }

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.payment.findUnique({
        where: { id: payment.id },
        include: { order: true },
      });

      if (!fresh || fresh.status === 'SUCCESS') {
        return;
      }

      // Settle the wallet portion that was reserved (but not debited) at checkout.
      const walletAppliedPaise = fresh.order.walletAppliedPaise;
      if (walletAppliedPaise > 0) {
        const existingSpend = await tx.walletTransaction.findFirst({
          where: { orderId: fresh.orderId, reason: 'ORDER_SPEND' },
        });

        if (!existingSpend) {
          await tx.$executeRaw`SELECT "walletBalance" FROM "users" WHERE id = ${fresh.order.userId} FOR UPDATE`;

          const user = await tx.user.findUnique({
            where: { id: fresh.order.userId },
            select: { walletBalance: true },
          });

          if (!user || user.walletBalance < walletAppliedPaise) {
            throw new ConflictException(
              'Wallet balance changed while the payment was in flight. Please retry with a smaller wallet amount.',
            );
          }

          await tx.user.update({
            where: { id: fresh.order.userId },
            data: { walletBalance: { decrement: walletAppliedPaise } },
          });

          await tx.walletTransaction.create({
            data: {
              userId: fresh.order.userId,
              amountInPaise: -walletAppliedPaise,
              reason: 'ORDER_SPEND',
              orderId: fresh.orderId,
            },
          });
        }
      }

      await tx.payment.update({
        where: { id: fresh.id },
        data: {
          status: 'SUCCESS',
          gatewayPaymentId: gatewayPaymentId || fresh.gatewayPaymentId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_CAPTURED',
          actorId: fresh.order.userId,
          recordId: fresh.orderId,
          diff: {
            gatewayOrderId,
            gatewayPaymentId,
            amountInPaise: fresh.amountInPaise,
            walletAppliedPaise,
          },
        },
      });
    });

    this.logger.log(`✅ Order ${payment.orderId} settled via Razorpay (${gatewayOrderId})`);
    return { alreadyProcessed: false, orderId: payment.orderId };
  }

  /**
   * Marks a payment failed. Never downgrades a payment that already succeeded.
   */
  async markPaymentFailed(gatewayOrderId: string, reason?: string) {
    const payment = await this.prisma.payment.findFirst({ where: { gatewayOrderId } });
    if (!payment || payment.status === 'SUCCESS') {
      return null;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });

    this.logger.warn(
      `⚠️ Payment ${gatewayOrderId} failed for order ${payment.orderId}: ${reason || 'gateway reported failure'}`,
    );

    return { orderId: payment.orderId };
  }

  async getWalletBalance(userId: string, actor: AuthenticatedActor) {
    if (actor?.role !== 'ADMIN' && actor?.sub !== userId) {
      throw new ForbiddenException('You can only view your own wallet');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const transactions = await this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // User.walletBalance is the single source of truth. The ledger explains it,
    // it does not define it (a missing bonus txn previously made the two diverge).
    return {
      userId,
      balanceInPaise: user.walletBalance,
      balanceRupees: user.walletBalance / 100,
      transactions,
    };
  }

  private signaturesMatch(expected: string, received: string): boolean {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}
