import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { BILLING_EVENT_LOG_QUEUE } from 'src/common/redis/redis.constants';
import { RedisService } from 'src/common/redis/redis.service';
import { SubscriptionsService } from 'src/subscription/subscription.service';

@Injectable()
export class BillingEventQueueScheduler {
  constructor(
    private readonly redis: RedisService,
    private readonly subscriptionService: SubscriptionsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BillingEventQueueScheduler.name);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleQueue(): Promise<void> {
    const payloads: any[] = [];

    try {
      let item: string | null;

      while ((item = await this.redis.lpop(BILLING_EVENT_LOG_QUEUE))) {
        try {
          const parsed = JSON.parse(item);
          payloads.push(parsed);
        } catch (error) {
          this.logger.warn(
            { error, item },
            'Invalid JSON in billing event queue',
          );
        }
      }

      if (payloads.length) {
        await this.subscriptionService.persistBillingEvents(payloads);
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to process billing event queue');
    }
  }
}
