import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './common/redis/redis.module';
import appConfig from './config/app.config';
import redisConfig from './config/redis.config';
import rmqConfig from './config/rmq.config';
import { PrismaModule } from './database/prisma.module';
import { LoggerModule } from './logger/logger.module';
import { PaymentModule } from './payment/payment.module';
import { PlanModule } from './plan/plan.module';
import { ProductModule } from './product/product.module';
import { SubscriptionsModule } from './subscription/subscription.module';

@Module({
  imports: [
    // Configurations
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, redisConfig, rmqConfig],
    }),

    // Cache
    RedisModule,

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

    PrismaModule,

    SubscriptionsModule,

    ProductModule,

    PlanModule,

    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
