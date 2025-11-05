import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { BLWebhookBody } from './banglalink.webhook.service';
import { WEBHOOK_RECEIVER_QUEUES } from './constants/queue.constants';

@Injectable()
export class WebhookService {
  private readonly webhookQueues: Record<string, Queue<BLWebhookBody>>;

  constructor(
    @InjectQueue(WEBHOOK_RECEIVER_QUEUES.BL)
    private readonly blWebhookQueue: Queue<BLWebhookBody>,
    @InjectQueue(WEBHOOK_RECEIVER_QUEUES.BKASH)
    private readonly bkashWebhookQueue: Queue<BLWebhookBody>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WebhookService.name);

    this.webhookQueues = {
      BL: this.blWebhookQueue,
      BKASH: this.bkashWebhookQueue,
    };
  }

  async receive(provider: string, payload: BLWebhookBody) {
    const queue = this.webhookQueues[provider];

    if (!queue) {
      this.logger.error({
        msg: 'Unknown provider. Cannot dispatch job.',
        provider,
      });
      return;
    }

    const jobName = 'webhook-received';

    await queue.add(jobName, payload, {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });

    this.logger.debug({
      msg: 'Webhook job dispatched',
      queue: queue.name,
    });
  }
}
