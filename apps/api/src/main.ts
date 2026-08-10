import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

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

  // CORS for Next.js frontend
  app.enableCors({
    origin: [
      'http://localhost:3000',
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ],
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 CraveOS API running on http://localhost:${port}/api/v1`);
  console.log(`🌿 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
