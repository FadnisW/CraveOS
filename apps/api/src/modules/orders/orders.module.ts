import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PricingModule } from '../pricing/pricing.module';
import { QueueModule } from '../queue/queue.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { WebsocketsModule } from '../websockets/websockets.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PricingModule, QueueModule, LogisticsModule, WebsocketsModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

