import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebsocketsModule } from './modules/websockets/websockets.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    // Config module — loads .env from monorepo root
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),

    // Cron scheduling
    ScheduleModule.forRoot(),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    CatalogModule,
    PricingModule,
    OrdersModule,
    PaymentsModule,
    NotificationsModule,
    WebsocketsModule,
    LogisticsModule,
    QueueModule,
  ],
})
export class AppModule {}
