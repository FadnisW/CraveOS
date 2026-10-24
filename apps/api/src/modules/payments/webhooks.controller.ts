import {
  Controller,
  Post,
  Headers,
  Req,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { PaymentsService } from './payments.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('razorpay')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      this.logger.error('RAZORPAY_WEBHOOK_SECRET is not configured — refusing to process webhook.');
      throw new InternalServerErrorException('Webhook secret is not configured');
    }

    // Signature is mandatory. Previously a missing header skipped verification
    // entirely, so anyone could POST a fake "payment.captured" event.
    if (!signature) {
      throw new BadRequestException('Missing x-razorpay-signature header');
    }

    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (!this.signaturesMatch(expectedSignature, signature)) {
      this.logger.error('❌ Razorpay webhook signature verification failed.');
      throw new BadRequestException('Invalid signature');
    }

    const payload = req.body;
    const event = payload?.event;
    this.logger.log(`🔔 Razorpay webhook received: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderEntity = payload.payload?.order?.entity;
      const gatewayOrderId = paymentEntity?.order_id || orderEntity?.id;

      if (!gatewayOrderId) {
        return { status: 'ignored', reason: 'No gateway order id in payload' };
      }

      const result = await this.paymentsService.markPaymentSuccess(
        gatewayOrderId,
        paymentEntity?.id,
      );

      if (!result) {
        return { status: 'ignored', reason: 'Unknown gateway order' };
      }

      return {
        status: result.alreadyProcessed ? 'already_processed' : 'ok',
        orderId: result.orderId,
      };
    }

    if (event === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const gatewayOrderId = paymentEntity?.order_id;

      if (gatewayOrderId) {
        await this.paymentsService.markPaymentFailed(
          gatewayOrderId,
          paymentEntity?.error_description,
        );
      }

      return { status: 'ok' };
    }

    return { status: 'ok' };
  }

  private signaturesMatch(expected: string, received: string): boolean {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}
