import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { SUBSCRIPTION_POST_CONSENT_QUEUE } from 'src/common/redis/redis.constants';
import { RedisService } from 'src/common/redis/redis.service';
import {
  SubscriptionData,
  SubscriptionsService,
} from 'src/subscription/subscription.service';

@Injectable()
export class SubscriptionQueueScheduler {
  constructor(
    private readonly redis: RedisService,
    private readonly subscriptionService: SubscriptionsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SubscriptionQueueScheduler.name);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleQueue(): Promise<void> {
    const payloads: SubscriptionData[] = [];

    try {
      let item: string | null;

      while ((item = await this.redis.lpop(SUBSCRIPTION_POST_CONSENT_QUEUE))) {
        try {
          const parsed = JSON.parse(item) as SubscriptionData;
          payloads.push(parsed);
        } catch (error) {
          this.logger.warn(
            { error, item },
            'Invalid JSON in subscription queue',
          );
        }
      }

      if (payloads.length) {
        await this.subscriptionService.persistSubscriptionEvents(payloads);
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to process subscription queue');
    }
  }
}
