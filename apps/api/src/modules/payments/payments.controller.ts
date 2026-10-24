import { Controller, Post, Body, Get, Param, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Creates a gateway order for an existing CraveOS order.
   * The amount is always taken from the stored order — the client cannot set it.
   */
  @Post('create-razorpay-order')
  @Roles('CUSTOMER', 'ADMIN')
  async createRazorpayOrder(@Request() req: any, @Body('orderId') orderId: string) {
    return this.paymentsService.createRazorpayOrder(orderId, req.user as AuthenticatedActor);
  }

  /**
   * Verifies the Razorpay checkout callback so the client can confirm success
   * without waiting for the (possibly delayed) webhook.
   */
  @Post('verify')
  @Roles('CUSTOMER', 'ADMIN')
  async verifyPayment(
    @Request() req: any,
    @Body()
    body: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    },
  ) {
    return this.paymentsService.verifyPayment(body, req.user as AuthenticatedActor);
  }

  @Get('wallet/:userId')
  @Roles('CUSTOMER', 'ADMIN')
  async getWalletBalance(@Request() req: any, @Param('userId') userId: string) {
    return this.paymentsService.getWalletBalance(userId, req.user as AuthenticatedActor);
  }
}
