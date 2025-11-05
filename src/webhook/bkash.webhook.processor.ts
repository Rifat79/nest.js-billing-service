import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { BkashWebhook, BkashWebhookService } from './bkash.webhook.service';
import { WEBHOOK_RECEIVER_QUEUES } from './constants/queue.constants';

@Processor(WEBHOOK_RECEIVER_QUEUES.BKASH, { concurrency: 10 })
export class BkashWebhookProcessor extends WorkerHost {
  constructor(
    private readonly logger: PinoLogger,
    @InjectQueue(WEBHOOK_RECEIVER_QUEUES.BKASH)
    private readonly bkashWebhookService: BkashWebhookService,
  ) {
    super();
    this.logger.setContext(BkashWebhookProcessor.name);
  }

  async process(job: Job<BkashWebhook>): Promise<void> {
    const payload = job.data;

    try {
      if (payload.subscriptionStatus) {
        await this.bkashWebhookService.handleSubscriptionEvent(payload);
      } else {
        await this.bkashWebhookService.handlePaymentEvent(payload);
      }

      this.logger.info({
        msg: 'Bkash webhook processed',
        jobId: job.id,
        subscriptionId: payload.subscriptionId,
        subscriptionRequestId: payload.subscriptionRequestId,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Bkash webhook processing failed',
        jobId: job.id,
        subscriptionId: payload.subscriptionId,
        subscriptionRequestId: payload.subscriptionRequestId,
        error: error.message,
        stack: error.stack,
        payload,
      });
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<BkashWebhook>, error: Error) {
    this.logger.error(
      `Job ${job.id} for subscriptionRequestId: ${job.data.subscriptionRequestId} failed in ${WEBHOOK_RECEIVER_QUEUES.BKASH} with error: ${error.message}`,
    );
  }
}
