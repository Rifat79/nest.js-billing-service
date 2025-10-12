import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly logger: PinoLogger) {}

  async createSubscription(data: CreateSubscriptionDto) {
    try {
      const { msisdn, transactionId, urls, paymentProvider, keyword } =
        data.body;
    } catch (e) {
      this.logger.error({});
    }
  }
  async cancelSubscription() {
    return 0;
  }
}
