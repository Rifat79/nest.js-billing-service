import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BillingEventModule } from 'src/billing-event/billing-event.module';
import { EventPublisherModule } from 'src/event-publisher/event-publisher.module';
import { PaymentModule } from 'src/payment/payment.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { BanglalinkWebhookService } from './banglalink.webhook.service';
import { WEBHOOK_RECEIVER_QUEUES } from './constants/queue.constants';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: WEBHOOK_RECEIVER_QUEUES.BL },
      { name: WEBHOOK_RECEIVER_QUEUES.BKASH },
    ),
    SubscriptionModule,
    EventPublisherModule,
    BillingEventModule,
    PaymentModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService, BanglalinkWebhookService],
})
export class WebhookModule {}
