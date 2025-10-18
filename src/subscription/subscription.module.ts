import { Module } from '@nestjs/common';
import { PaymentModule } from 'src/payment/payment.module';
import { ProductModule } from 'src/product/product.module';
import { SubscriptionsController } from './subscription.controller';
import { SubscriptionsService } from './subscription.service';

@Module({
  imports: [ProductModule, PaymentModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionModule {}
