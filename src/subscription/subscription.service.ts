import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from 'src/common/redis/redis.service';
import { ProductRepository } from 'src/database/product.repository';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly productRepo: ProductRepository,
    private readonly redis: RedisService,
  ) {}

  async createSubscription(
    data: CreateSubscriptionDto,
  ): Promise<{ url: string }> {
    try {
      const { msisdn, transactionId, urls, paymentProvider, keyword, amount } =
        data.body;

      const product = await this.productRepo.findByName(keyword);

      if (!product) {
        throw new Error(`Product with keyword "${keyword}" was not found`);
      }

      return { url: '' };
    } catch (e) {
      this.logger.error({});
      throw e;
    }
  }

  // async cancelSubscription() {
  //   return 0;
  // }
}
