import { Module } from '@nestjs/common';
import { HubOpsController } from './hub-ops.controller';
import { HubOpsService } from './hub-ops.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [PrismaModule, WebsocketsModule],
  controllers: [HubOpsController],
  providers: [HubOpsService],
  exports: [HubOpsService],
})
export class HubOpsModule {}
