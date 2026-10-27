import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../common/prisma/prisma.service';
import { redisUrl } from '../../common/config/env.validation';

type CheckStatus = 'up' | 'down';

export interface HealthCheck {
  status: CheckStatus;
  latencyMs: number;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  checkedAt: string;
  uptimeSeconds: number;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
  };
}

const CHECK_TIMEOUT_MS = 3000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      status: database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startedAt = Date.now();

    try {
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`, 'database');
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      // Log the detail server-side; the public response never includes
      // connection strings or driver internals.
      this.logger.error(`Database health check failed: ${errorMessage(error)}`);
      return { status: 'down', latencyMs: Date.now() - startedAt };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const startedAt = Date.now();
    const client = new Redis(redisUrl(), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: CHECK_TIMEOUT_MS,
      retryStrategy: () => null,
    });

    // A rejected command surfaces through connect()/ping(); this listener only
    // prevents ioredis from emitting an unhandled 'error' event.
    client.on('error', () => undefined);

    try {
      await this.withTimeout(
        client.connect().then(() => client.ping()),
        'redis',
      );
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      this.logger.error(`Redis health check failed: ${errorMessage(error)}`);
      return { status: 'down', latencyMs: Date.now() - startedAt };
    } finally {
      client.disconnect();
    }
  }

  private async withTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(`${label} check timed out after ${CHECK_TIMEOUT_MS}ms`),
              ),
            CHECK_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
