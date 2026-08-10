import { Module } from '@nestjs/common';
import { OrderTrackingGateway } from './websockets.gateway';

@Module({
  providers: [OrderTrackingGateway],
  exports: [OrderTrackingGateway],
})
export class WebsocketsModule {}
