import { Controller, Post, Headers, Req, BadRequestException, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'eatclub_webhook_secret_key';
    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

    // 1. Verify HMAC SHA256 Signature
    if (signature) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        this.logger.error('❌ Razorpay webhook signature verification failed.');
        throw new BadRequestException('Invalid signature');
      }
    }

    const payload = req.body;
    const event = payload?.event;
    this.logger.log(`🔔 Razorpay Webhook received event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity || payload.payload?.order?.entity;
      const gatewayOrderId = paymentEntity?.order_id || paymentEntity?.id;

      if (!gatewayOrderId) {
        return { status: 'ignored', reason: 'No gateway order ID in payload' };
      }

      // 2. Idempotency Check & Transaction State Machine Update
      const existingPayment = await this.prisma.payment.findFirst({
        where: { gatewayOrderId },
      });

      if (existingPayment && existingPayment.status === 'SUCCESS') {
        this.logger.log(`ℹ️ Webhook already processed for gateway order ${gatewayOrderId}. Idempotency acknowledged.`);
        return { status: 'already_processed' };
      }

      // 3. Atomically update Payment and Parent Order to SUCCESS / CONFIRMED
      if (existingPayment) {
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: existingPayment.id },
            data: { status: 'SUCCESS' },
          });

          await tx.order.update({
            where: { id: existingPayment.orderId },
            data: { status: 'ACCEPTED_BY_KITCHEN' },
          });
          this.logger.log(`✅ Order ${existingPayment.orderId} status set to ACCEPTED_BY_KITCHEN via Razorpay webhook.`);
        });
      }
    }

    return { status: 'ok' };
  }
}
