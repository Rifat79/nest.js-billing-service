import { Module } from '@nestjs/common';
import { EventPublisherModule } from 'src/event-publisher/event-publisher.module';
import { PaymentModule } from 'src/payment/payment.module';
import { ProductModule } from 'src/product/product.module';
import { SubscriptionsController } from './subscription.controller';
import { SubscriptionsService } from './subscription.service';

@Module({
  imports: [ProductModule, PaymentModule, EventPublisherModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionModule {}
