import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { MembershipCronService } from './membership-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PricingController],
  providers: [PricingService, MembershipCronService],
  exports: [PricingService],
})
export class PricingModule {}

