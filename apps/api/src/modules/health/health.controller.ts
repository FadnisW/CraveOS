import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Readiness probe. Returns 200 only when PostgreSQL and Redis both answer.
   * No authentication and no secrets: safe for a load balancer or uptime probe.
   */
  @Get()
  @Public()
  async check(@Res({ passthrough: true }) response: Response) {
    const report = await this.healthService.check();
    response.status(report.status === 'ok' ? 200 : 503);
    return report;
  }
}
