import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from './config/app.config';
import rmqConfig from './config/rmq.config';
import { LoggerModule } from './logger/logger.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    // Configurations
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, rmqConfig],
    }),

    // RabbitMQ Client for publishing events
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.getOrThrow<string>('rmq.url')],
            queue: configService.getOrThrow<string>('rmq.queue'),
            queueOptions: {
              durable: true,
              arguments: {
                'x-message-ttl': 86400000, // 24 hours
                'x-dead-letter-exchange': 'dlx.notifications',
              },
            },
            prefetchCount: 10,
            persistent: true,
            noAck: false,
          },
        }),
        inject: [ConfigService],
      },
    ]),

    // Logger
    LoggerModule,

    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
