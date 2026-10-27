import { Module } from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { LogisticsController } from './logistics.controller';
import { StaleTrackingCronService } from './stale-tracking-cron.service';
import { WebsocketsModule } from '../websockets/websockets.module';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [WebsocketsModule, ReferralsModule],
  controllers: [LogisticsController],
  providers: [LogisticsService, StaleTrackingCronService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
