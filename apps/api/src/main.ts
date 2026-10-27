import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { corsOrigins } from './common/config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger('Bootstrap');

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
