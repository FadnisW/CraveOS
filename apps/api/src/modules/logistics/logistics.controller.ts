import { Controller, Post, Param, Get } from '@nestjs/common';
import { LogisticsService } from './logistics.service';

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('auto-assign/:orderId')
  async autoAssignRider(@Param('orderId') orderId: string) {
    return this.logisticsService.autoAssignRider(orderId);
  }

  @Get('trips')
  async getActiveTrips() {
    return this.logisticsService.getActiveTrips();
  }
}
