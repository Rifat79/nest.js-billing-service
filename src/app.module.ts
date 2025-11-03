import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CallbackModule } from './callback/callback.module';
import { RedisModule } from './common/redis/redis.module';
import appConfig from './config/app.config';
import dbConfig from './config/db.config';
import redisConfig from './config/redis.config';
import rmqConfig from './config/rmq.config';
import { PrismaModule } from './database/prisma.module';
import { EventPublisherModule } from './event-publisher/event-publisher.module';
import { LoggerModule } from './logger/logger.module';
import { PaymentModule } from './payment/payment.module';
import { ProductModule } from './product/product.module';
import { QueueSchedulerModule } from './scheduler/scheduler.module';
import { SubscriptionModule } from './subscription/subscription.module';

@Module({
  imports: [
    // Configurations
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, redisConfig, rmqConfig, dbConfig],
    }),

    // Cache
    RedisModule,

    // Logger
    LoggerModule,

    // Prisma
    PrismaModule.forRoot({
      isGlobal: true,
      serviceName: 'billing-service',
    }),

    SubscriptionModule,

    CallbackModule,

    ProductModule,

    PaymentModule,

    EventPublisherModule,

    QueueSchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
