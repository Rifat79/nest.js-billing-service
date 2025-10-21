import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);

  const host = configService.getOrThrow<string>('app.host', '0.0.0.0');
  const port = configService.getOrThrow<number>('app.port');
  const httpPort = configService.getOrThrow<number>('app.httpPort');

  // TCP Microservice for receiving requests from API Gateway
  const microserviceOptions: MicroserviceOptions = {
    transport: Transport.TCP,
    options: {
      host,
      port,
      retryAttempts: 5,
      retryDelay: 3000,
    },
  };
  app.connectMicroservice<MicroserviceOptions>(microserviceOptions, {
    inheritAppConfig: true,
  });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Graceful shutdown

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((err) => {
      logger.error('Error during SIGINT shutdown', err);
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((err) => {
      logger.error('Error during SIGTERM shutdown', err);
      process.exit(1);
    });
  });

  async function shutdown(signal: string) {
    logger.log(`${signal} received: closing HTTP server`);
    try {
      await app.close();
      logger.log('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown failed', error);
      process.exit(1);
    }
  }

  await app.startAllMicroservices();

  await app.listen(httpPort);

  const serviceName = configService.get<string>(
    'SERVICE_NAME',
    'billing-service',
  );

  logger.log(
    `🚀 ${serviceName} is running on HTTP: http://${host}:${httpPort}`,
  );
  logger.log(
    `🔗 ${serviceName} is listening for TCP microservice requests on: tcp://${host}:${port}`,
  );
}

bootstrap().catch((error) => {
  console.error('Failed to start Billing Service:', error);
  process.exit(1);
});
