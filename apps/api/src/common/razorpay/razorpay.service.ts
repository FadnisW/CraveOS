import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

export interface RazorpayOrderInput {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}

/**
 * Small wrapper around the Razorpay SDK for non-order payments.
 *
 * Order payments are settled by PaymentsService. This service exists so
 * membership purchases can create and verify gateway orders without
 * duplicating credential handling at every call site.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly client: any;
  private readonly keySecret: string;

  readonly keyId: string;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (!this.keyId || !this.keySecret) {
      this.logger.error(
        'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured — membership gateway payments will fail.',
      );
      this.client = null;
    } else {
      this.client = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });
    }
  }

  get isConfigured() {
    return !!this.client;
  }

  async createOrder(input: RazorpayOrderInput) {
    if (!this.client) {
      throw new InternalServerErrorException('Payment gateway is not configured');
    }

    if (!Number.isInteger(input.amountInPaise) || input.amountInPaise <= 0) {
      throw new InternalServerErrorException(
        'Refusing to create a gateway order for a non-positive amount',
      );
    }

    return this.client.orders.create({
      amount: input.amountInPaise,
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes || {},
    });
  }

  verifyPaymentSignature(
    gatewayOrderId: string,
    gatewayPaymentId: string,
    signature: string,
  ) {
    if (!this.keySecret) return false;

    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(signature || ''), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}
