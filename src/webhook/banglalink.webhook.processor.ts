import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import {
  BanglalinkWebhookService,
  BLWebhookBody,
  BlWebhookCommand,
} from './banglalink.webhook.service';
import { WEBHOOK_RECEIVER_QUEUES } from './constants/queue.constants';

@Processor(WEBHOOK_RECEIVER_QUEUES.BL, { concurrency: 20 })
export class BlWebhookProcessor extends WorkerHost {
  constructor(
    private readonly logger: PinoLogger,
    @InjectQueue(WEBHOOK_RECEIVER_QUEUES.BL)
    private readonly blWebhookService: BanglalinkWebhookService,
  ) {
    super();
  }

  async process(job: Job<BLWebhookBody>): Promise<void> {
    const { msisdn, offerId, subscriptionStatus, command } =
      this.blWebhookService.extractPayload(job.data);

    if (command === BlWebhookCommand.ACTIVATION) {
      await this.blWebhookService.handleActivation({
        msisdn,
        offerId,
        subscriptionStatus,
      });
    } else if (command === BlWebhookCommand.RENEWAL) {
      await this.blWebhookService.handleRenewal({
        msisdn,
        offerId,
        subscriptionStatus,
      });
    } else if (command === BlWebhookCommand.DEACTIVATION) {
      await this.blWebhookService.handleDeactivation({
        msisdn,
        offerId,
        subscriptionStatus,
      });
    } else {
      this.logger.warn({
        msg: `Unknown command: ${command}`,
        payload: job.data,
      });
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<BLWebhookBody>, error: Error) {
    this.logger.error(
      `Job ${job.id} for ${job.data.requestId} failed in ${WEBHOOK_RECEIVER_QUEUES.BL} with error: ${error.message}`,
    );
  }
}
