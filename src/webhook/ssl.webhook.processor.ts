import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { WEBHOOK_RECEIVER_QUEUES } from './constants/queue.constants';
import { SSLWebhook, SSLWebhookService } from './ssl.webhook.service';

@Processor(WEBHOOK_RECEIVER_QUEUES.SSL, { concurrency: 10 })
export class SSLWebhookProcessor extends WorkerHost {
  constructor(
    private readonly logger: PinoLogger,
    @InjectQueue(WEBHOOK_RECEIVER_QUEUES.SSL)
    private readonly sslWebhookService: SSLWebhookService,
  ) {
    super();
    this.logger.setContext(SSLWebhookProcessor.name);
  }

  async process(job: Job<SSLWebhook>): Promise<void> {
    const payload = job.data;

    try {
      await this.sslWebhookService.record(payload);

      this.logger.info({
        msg: 'SSL webhook processed',
        jobId: job.id,
        subscriptionId: payload.tran_id,
      });
    } catch (error) {
      this.logger.error({
        msg: 'SSL webhook processing failed',
        jobId: job.id,
        subscriptionId: payload.tran_id,
        error: error,
        payload,
      });
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SSLWebhook>, error: Error) {
    this.logger.error(
      `Job ${job.id} for subscriptionRequestId: ${job.data.tran_id} failed in ${WEBHOOK_RECEIVER_QUEUES.BKASH} with error: ${error.message}`,
    );
  }
}
