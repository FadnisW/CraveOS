import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { redisUrl } from '../config/env.validation';

/**
 * Server-side revocation for stateless JWTs.
 *
 * A signed JWT is valid until it expires, so clearing a browser cookie is not
 * enough to end a session: a copy of the token would keep working. Every token
 * now carries a `jti`; logout writes that id to Redis with a TTL equal to the
 * token's remaining lifetime. The guard and the socket gateway refuse any token
 * whose `jti` is on the list.
 *
 * If Redis is unavailable the check fails closed: an unverifiable session must
 * not be treated as valid.
 */
@Injectable()
export class TokenDenylistService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenDenylistService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(redisUrl());
    this.redis.on('connect', () =>
      this.logger.log('🔴 Redis connected for token revocation'),
    );
    this.redis.on('error', (err) =>
      this.logger.warn(`Redis error in token revocation: ${err.message}`),
    );
  }

  private key(jti: string) {
    return `jwt:revoked:${jti}`;
  }

  /**
   * Records a token id as revoked. The entry is deleted automatically once the
   * token would have expired anyway, so the list cannot grow without bound.
   */
  async revoke(jti?: string, expiresAtSeconds?: number) {
    if (!jti) {
      // Tokens issued before Phase 3 have no jti and cannot be individually
      // revoked. Rotating JWT_SECRET is the only way to invalidate them.
      return false;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttl =
      Number.isFinite(expiresAtSeconds) && Number(expiresAtSeconds) > nowSeconds
        ? Number(expiresAtSeconds) - nowSeconds
        : 30 * 24 * 60 * 60;

    await this.redis.set(this.key(jti), '1', 'EX', Math.max(1, ttl));
    return true;
  }

  async isRevoked(jti?: string) {
    if (!jti) return false;

    try {
      return (await this.redis.exists(this.key(jti))) === 1;
    } catch (error: any) {
      this.logger.error(
        `Token revocation check failed: ${error?.message || 'unknown error'}`,
      );
      throw new ServiceUnavailableException(
        'Session validation is temporarily unavailable. Please retry.',
      );
    }
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
