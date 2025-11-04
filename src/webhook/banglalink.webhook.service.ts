import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { PaymentProvider } from 'src/common/enums/payment-providers';
import { WEBHOOK_RECEIVER_QUEUE } from 'src/common/redis/redis.constants';
import { RedisService } from 'src/common/redis/redis.service';

// Key/value entries inside requestParam.data[]
export interface BLWebhookDataItem {
  name: string;
  value: string;
}

// requestParam object (varies by command)
export interface BLWebhookRequestParam {
  data: BLWebhookDataItem[];
  command: 'NotifyActivation' | 'NotifyRenewal' | 'NotifyDeActivation';
  subscriptionOfferID?: string;
  planId?: string;
}

// Main webhook body from Banglalink
export interface BLWebhookBody {
  requestId: string;
  requestTimeStamp: string;
  channel: string;
  requestParam: BLWebhookRequestParam;
  msisdn: string;
  featureId: string;
}

interface Event {
  msisdn: string;
  command: string;
  subscriptionStatus: string;
  offerId: string;
}

@Injectable()
export class BanglalinkWebhookService {
  private readonly queue = `${WEBHOOK_RECEIVER_QUEUE}:${PaymentProvider.BANGLALINK}`;

  constructor(
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async process() {
    const events: Event[] = [];

    for (let i = 0; i < 1000; i++) {
      const raw = await this.redis.lpop(this.queue);
      if (!raw) {
        break;
      }

      const parsed = JSON.parse(raw) as BLWebhookBody;

      const { msisdn } = parsed;
      const { command } = parsed.requestParam;

      const subscriptionStatus =
        parsed.requestParam.data.find(
          (item) => item.name === 'SubscriptionStatus',
        )?.value || '';

      const offerId =
        parsed.requestParam.subscriptionOfferID ??
        (parsed.requestParam.data.find((item) => item.name === 'OfferCode')
          ?.value ||
          '');

      events.push({
        msisdn,
        command,
        subscriptionStatus,
        offerId,
      });
    }
  }
}
