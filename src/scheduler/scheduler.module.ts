import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionsService } from 'src/subscription/subscription.service';
import { BillingEventQueueScheduler } from './billing-event-queue.scheduler';
import { SubscriptionQueueScheduler } from './subscription-queue.scheduler';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    SubscriptionsService,
    SubscriptionQueueScheduler,
    BillingEventQueueScheduler,
  ],
})
export class QueueSchedulerModule {}
