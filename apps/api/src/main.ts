import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { corsOrigins } from './common/config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Express must trust the proxy hop that sets X-Forwarded-For before `req.ip`
  // reflects the browser address used by OTP rate limiting. Default off: an
  // API exposed directly must not believe a client-supplied header.
  const trustProxy = Number(process.env.TRUST_PROXY || 0);
  if (Number.isFinite(trustProxy) && trustProxy > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  }

  // Baseline response hardening. Helmet is not installed; these are the
  // headers that matter for a JSON API and cost nothing to send.
  app.use((_req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    // Order, wallet and membership responses must never be cached by a shared
    // proxy or the browser back/forward cache.
    res.setHeader('Cache-Control', 'no-store');
    res.removeHeader('X-Powered-By');
    if (isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  });

  // CORS for the storefront. Production origins are validated as explicit
  // HTTPS URLs at startup; development adds http://localhost:3000.
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });

  // Let Nest close Prisma, BullMQ workers and Redis connections on SIGTERM.
  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`CraveOS API listening on port ${port} (prefix /api/v1)`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // Startup errors are configuration errors. Print the reason without a stack
  // that points at internals, then exit non-zero so a supervisor can react.
  console.error(`CraveOS API failed to start:\n${message}`);
  process.exit(1);
});
