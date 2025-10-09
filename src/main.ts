import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const host = configService.getOrThrow<string>('app.host');
  const port = configService.getOrThrow<number>('app.port');
  const httpPort = configService.getOrThrow<number>('app.httpPort');

  // TCP Microservice for receiving requests from API Gateway
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host,
      port,
      retryAttempts: 5,
      retryDelay: 3000,
    },
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.startAllMicroservices();

  await app.listen(httpPort);

  logger.log(`🚀 Billing service is running on: http://${host}:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Billing Service:', error);
  process.exit(1);
});
