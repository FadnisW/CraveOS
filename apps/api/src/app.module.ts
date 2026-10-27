import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
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
import { RidersModule } from './modules/riders/riders.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { AdminModule } from './modules/admin/admin.module';
import { HubOpsModule } from './modules/hub-ops/hub-ops.module';
import { BrandOpsModule } from './modules/brand-ops/brand-ops.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtConfigModule } from './common/auth/jwt-config.module';
import { validateEnv } from './common/config/env.validation';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Config module — loads .env from monorepo root and fails fast on an
    // unsafe production configuration (weak secret, missing DB/Redis,
    // DEV_OTP_BYPASS, non-HTTPS CORS origin).
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),

    // Cron scheduling
    ScheduleModule.forRoot(),

    // Database
    PrismaModule,

    // Auth: one JWT configuration for the whole app (fails fast without JWT_SECRET)
    JwtConfigModule,

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
    RidersModule,
    TicketsModule,
    AdminModule,
    HubOpsModule,
    BrandOpsModule,
    AddressesModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

