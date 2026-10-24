import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Single JWT configuration for the whole application.
 *
 * Previously AuthModule and RidersModule each registered JwtModule with a
 * *different* hardcoded fallback secret, so rider tokens were signed with one
 * key and verified by the global RolesGuard with another — every rider API
 * call returned 401. There is now exactly one secret, and it is mandatory.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error(
            'JWT_SECRET is not set. Add it to .env before starting the API — tokens must not be signed with a fallback secret.',
          );
        }

        return {
          secret,
          signOptions: { expiresIn: '30d' },
        };
      },
    }),
  ],
  exports: [JwtModule],
})
export class JwtConfigModule {}
