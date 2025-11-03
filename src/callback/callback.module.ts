import { Module } from '@nestjs/common';
import { EventPublisherModule } from 'src/event-publisher/event-publisher.module';
import { PaymentModule } from 'src/payment/payment.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { CallbackStrategyFactory } from './callback-strategy.factory';
import { CallbackController } from './callback.controller';
import { CallbackService } from './callback.service';
import {
  BkashCallbackStrategy,
  GpCallbackStrategy,
  NagadCallbackStrategy,
  RobiCallbackStrategy,
  SSLCallbackStrategy,
} from './strategies';

@Module({
  imports: [SubscriptionModule, PaymentModule, EventPublisherModule],
  controllers: [CallbackController],
  providers: [
    CallbackService,
    CallbackStrategyFactory,
    GpCallbackStrategy,
    // Strategies
    RobiCallbackStrategy,
    BkashCallbackStrategy,
    SSLCallbackStrategy,
    NagadCallbackStrategy,
  ],
  exports: [CallbackService],
})
export class CallbackModule {}
