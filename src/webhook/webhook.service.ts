import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { BLWebhookBody } from './banglalink.webhook.service';
import { BkashWebhook } from './bkash.webhook.service';
import { WEBHOOK_RECEIVER_QUEUES } from './constants/queue.constants';
import { SSLWebhook } from './ssl.webhook.service';

type WebhookMap = {
  BL: BLWebhookBody;
  BKASH: BkashWebhook;
  SSL: SSLWebhook;
};

const JOB_NAMES = {
  BL: 'webhook:banglalink',
  BKASH: 'webhook:bkash',
  SSL: 'webhook:ssl',
} as const;

@Injectable()
export class WebhookService {
  private readonly webhookQueues: {
    [K in keyof WebhookMap]: Queue<any>; // 👈 intentionally loosened
  };

  constructor(
    @InjectQueue(WEBHOOK_RECEIVER_QUEUES.BL)
    private readonly blQueue: Queue<BLWebhookBody>,
    @InjectQueue(WEBHOOK_RECEIVER_QUEUES.BKASH)
    private readonly bkashQueue: Queue<BkashWebhook>,
    @InjectQueue(WEBHOOK_RECEIVER_QUEUES.SSL)
    private readonly sslQueue: Queue<SSLWebhook>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WebhookService.name);

    this.webhookQueues = {
      BL: this.blQueue,
      BKASH: this.bkashQueue,
      SSL: this.sslQueue,
    };
  }

  async receive<K extends keyof WebhookMap>(
    provider: K,
    payload: WebhookMap[K],
  ): Promise<void> {
    const queue = this.webhookQueues[provider];
    const jobName = JOB_NAMES[provider];

    await this.dispatchJob(queue, jobName, payload);

    this.logger.debug({
      msg: 'Webhook job dispatched',
      provider,
      queue: queue.name,
      jobName,
      // requestId: (payload as any).requestId,
    });
  }

  private async dispatchJob(
    queue: Queue<any>,
    jobName: string,
    payload: any,
  ): Promise<void> {
    await queue.add(jobName, payload, {
      // jobId: payload?.requestId,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}
