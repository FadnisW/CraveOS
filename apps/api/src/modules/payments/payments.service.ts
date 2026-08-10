import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: any;

  constructor(private readonly prisma: PrismaService) {
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_TO6NXsAXySXEqK';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'ei1ACT2b90q31H71701HVIkP';

    this.razorpay = new Razorpay({
      key_id,
      key_secret,
    });
  }

  async createRazorpayOrder(amountRupees: number, orderId: string) {
    const amountInPaise = Math.round(amountRupees * 100);

    try {
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_${orderId.substring(0, 30)}`,
        notes: {
          orderId,
        },
      };

      const razorpayOrder = await this.razorpay.orders.create(options);
      this.logger.log(`💳 Created real Razorpay Order: ${razorpayOrder.id} for ₹${amountRupees}`);

      // Upsert local Payment record linking parent order to gateway order
      if (orderId && orderId !== 'demo_order') {
        const existingOrder = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (existingOrder) {
          await this.prisma.payment.upsert({
            where: { orderId },
            update: {
              gateway: 'razorpay',
              gatewayOrderId: razorpayOrder.id,
              amountInPaise,
              status: 'INITIATED',
            },
            create: {
              orderId,
              gateway: 'razorpay',
              gatewayOrderId: razorpayOrder.id,
              amountInPaise,
              status: 'INITIATED',
            },
          });
        }
      }

      return {
        razorpayOrderId: razorpayOrder.id,
        amount: amountInPaise,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_TO6NXsAXySXEqK',
      };
    } catch (error: any) {
      this.logger.error('Failed to create Razorpay Order:', error);
      throw new InternalServerErrorException(error.message || 'Razorpay Order Creation Failed');
    }
  }

  async getWalletBalance(userId: string) {
    const txs = await this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const balanceInPaise = txs.reduce((sum, tx) => sum + tx.amountInPaise, 0);

    return {
      userId,
      balanceRupees: Math.max(0, balanceInPaise / 100),
      balanceInPaise: Math.max(0, balanceInPaise),
      transactions: txs,
    };
  }
}
