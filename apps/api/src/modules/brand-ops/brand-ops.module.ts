import { Module } from '@nestjs/common';
import { BrandOpsController } from './brand-ops.controller';
import { BrandOpsService } from './brand-ops.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BrandOpsController],
  providers: [BrandOpsService],
  exports: [BrandOpsService],
})
export class BrandOpsModule {}
