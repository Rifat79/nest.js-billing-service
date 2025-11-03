import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { BillingEventQueueScheduler } from './billing-event-queue.scheduler';
import { SubscriptionQueueScheduler } from './subscription-queue.scheduler';

@Module({
  imports: [ScheduleModule.forRoot(), SubscriptionModule],
  providers: [SubscriptionQueueScheduler, BillingEventQueueScheduler],
})
export class QueueSchedulerModule {}
