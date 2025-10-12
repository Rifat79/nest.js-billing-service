import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscription.controller';
import { SubscriptionsService } from './subscription.service';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
