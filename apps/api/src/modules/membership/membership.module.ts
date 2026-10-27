import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';
import { RazorpayService } from '../../common/razorpay/razorpay.service';

@Module({
  controllers: [MembershipController],
  providers: [MembershipService, RazorpayService],
  exports: [MembershipService],
})
export class MembershipModule {}
