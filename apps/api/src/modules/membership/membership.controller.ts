import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Request,
} from '@nestjs/common';
import { MembershipService } from './membership.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('plans')
  @Public()
  async listPlans() {
    return this.membershipService.listPlans();
  }

  @Get('me')
  @Roles('CUSTOMER', 'ADMIN')
  async getMyMembership(@Request() req: any) {
    return this.membershipService.getMyMembership(
      (req.user as AuthenticatedActor).sub,
    );
  }

  @Post('purchase')
  @Roles('CUSTOMER', 'ADMIN')
  async purchase(
    @Request() req: any,
    @Body()
    body: {
      planId?: string;
      planSlug?: string;
      paymentMethod?: string;
      idempotencyKey?: string;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.membershipService.purchase(
      (req.user as AuthenticatedActor).sub,
      {
        ...body,
        idempotencyKey: idempotencyKey || body?.idempotencyKey,
      },
    );
  }

  @Post('purchase/verify')
  @Roles('CUSTOMER', 'ADMIN')
  async verifyPurchase(
    @Request() req: any,
    @Body()
    body: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    },
  ) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('A payment verification payload is required');
    }
    return this.membershipService.verifyPurchase(
      (req.user as AuthenticatedActor).sub,
      body,
    );
  }
}
