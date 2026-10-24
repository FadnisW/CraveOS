import { Module } from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { LogisticsController } from './logistics.controller';
import { StaleTrackingCronService } from './stale-tracking-cron.service';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [WebsocketsModule],
  controllers: [LogisticsController],
  providers: [LogisticsService, StaleTrackingCronService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
