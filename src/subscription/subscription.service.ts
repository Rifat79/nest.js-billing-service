import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ProductRepository } from 'src/database/product.repository';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly productRepo: ProductRepository,
  ) {}

  async createSubscription(data: CreateSubscriptionDto) {
    try {
      const { msisdn, transactionId, urls, paymentProvider, keyword, amount } =
        data.body;
      return await this.productRepo.findByName('Truecaller');
    } catch (e) {
      this.logger.error({});
    }
  }
  async cancelSubscription() {
    return 0;
  }
}
