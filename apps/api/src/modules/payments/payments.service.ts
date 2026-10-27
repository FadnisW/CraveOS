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
        'This order has no gateway balance due - it is already settled by wallet.',
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
   *
   * When Razorpay supplies the captured amount, it must match the amount we
   * created the gateway order for. A webhook that says "captured ₹1" for a
   * ₹764 order must never settle the order.
   */
  async markPaymentSuccess(
    gatewayOrderId: string,
    gatewayPaymentId?: string,
    capturedAmountPaise?: number,
    currency?: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayOrderId },
      include: { order: true },
    });

    if (!payment) {
      this.logger.warn(`Received payment success for unknown gateway order ${gatewayOrderId}`);
      return null;
    }

    if (currency && currency.toUpperCase() !== 'INR') {
      this.logger.error(
        `Rejected payment ${gatewayOrderId}: currency ${currency} does not match INR`,
      );
      return { rejected: true, reason: 'CURRENCY_MISMATCH', orderId: payment.orderId };
    }

    if (
      typeof capturedAmountPaise === 'number' &&
      Number.isFinite(capturedAmountPaise) &&
      capturedAmountPaise !== payment.amountInPaise
    ) {
      this.logger.error(
        `Rejected payment ${gatewayOrderId}: captured ${capturedAmountPaise} paise but expected ${payment.amountInPaise}`,
      );
      return { rejected: true, reason: 'AMOUNT_MISMATCH', orderId: payment.orderId };
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

  /**
   * Refund money that was actually collected.
   *
   * Gateway payments go back through Razorpay; wallet payments are credited
   * back to the wallet. The payment row tracks how much has been refunded so a
   * second call cannot refund the same rupees again.
   */
  async refundOrder(
    orderId: string,
    amountPaise: number | undefined,
    reason: string,
    actorId: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { order: { select: { id: true, userId: true, status: true } } },
    });

    if (!payment || payment.status !== 'SUCCESS') {
      throw new BadRequestException('This order has no successful payment to refund');
    }

    const isWalletPayment = payment.gateway === 'wallet';

    // Wallet refunds are recorded as wallet transactions; gateway refunds are
    // recorded on the payment row. Keep the two ledgers separate so revenue
    // does not subtract the same refund twice.
    let alreadyRefundedPaise = payment.refundedAmountPaise;
    if (isWalletPayment) {
      const walletRefunds = await this.prisma.walletTransaction.aggregate({
        where: {
          orderId,
          reason: { in: ['ORDER_REFUND', 'PARTIAL_ORDER_REFUND'] },
        },
        _sum: { amountInPaise: true },
      });
      alreadyRefundedPaise = walletRefunds._sum.amountInPaise ?? 0;
    }

    const remainingPaise = payment.amountInPaise - alreadyRefundedPaise;
    if (remainingPaise <= 0) {
      throw new ConflictException('This payment has already been fully refunded');
    }

    const refundPaise =
      amountPaise === undefined || amountPaise === null
        ? remainingPaise
        : Math.round(Number(amountPaise));

    if (!Number.isInteger(refundPaise) || refundPaise <= 0) {
      throw new BadRequestException('Refund amount must be a positive whole number of paise');
    }
    if (refundPaise > remainingPaise) {
      throw new BadRequestException(
        `Refund exceeds the remaining refundable amount of ${remainingPaise} paise`,
      );
    }

    if (isWalletPayment) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: payment.order.userId },
          data: { walletBalance: { increment: refundPaise } },
        });
        await tx.walletTransaction.create({
          data: {
            userId: payment.order.userId,
            amountInPaise: refundPaise,
            reason: 'ORDER_REFUND',
            orderId,
          },
        });
        // Do not increment refundedAmountPaise here: wallet refunds are
        // tracked by the wallet ledger above. Revenue nets both ledgers, so
        // writing the same refund in both places would subtract it twice.
        await tx.payment.update({
          where: { id: payment.id },
          data: { refundedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            action: 'WALLET_REFUND',
            actorId,
            recordId: orderId,
            diff: { refundPaise, reason, gateway: 'wallet' },
          },
        });
      });

      return {
        orderId,
        refundPaise,
        gateway: 'wallet',
        refundId: null,
      };
    }

    if (!this.razorpay) {
      throw new InternalServerErrorException('Payment gateway is not configured');
    }
    if (!payment.gatewayPaymentId) {
      throw new BadRequestException('The gateway payment id is missing; cannot issue a refund');
    }

    let gatewayRefund: any;
    try {
      gatewayRefund = await this.razorpay.payments.refund(payment.gatewayPaymentId, {
        amount: refundPaise,
        notes: { orderId, reason },
      });
    } catch (error: any) {
      this.logger.error(`Razorpay refund failed for order ${orderId}:`, error);
      throw new InternalServerErrorException(
        error?.error?.description || error?.message || 'Razorpay refund failed',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmountPaise: { increment: refundPaise },
          refundId: gatewayRefund?.id || null,
          refundedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'GATEWAY_REFUND',
          actorId,
          recordId: orderId,
          diff: {
            refundPaise,
            reason,
            gateway: 'razorpay',
            refundId: gatewayRefund?.id || null,
          },
        },
      });
    });

    this.logger.log(
      `Refunded ${refundPaise} paise for order ${orderId} via Razorpay (${gatewayRefund?.id})`,
    );

    return {
      orderId,
      refundPaise,
      gateway: 'razorpay',
      refundId: gatewayRefund?.id || null,
    };
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
