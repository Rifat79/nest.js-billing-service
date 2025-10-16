import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from 'src/common/redis/redis.service';
import { PlanPricingRepository } from 'src/database/plan-pricing.repository';
import { PlanRepository } from 'src/database/plan.repository';
import { ProductRepository } from 'src/database/product.repository';

@Injectable()
export class ProductService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
    private readonly productRepo: ProductRepository,
    private readonly planRepo: PlanRepository,
    private readonly planPricingRepo: PlanPricingRepository,
  ) {}

  async getProductPlanWithPricing(
    name: string,
    pricingAmount: number,
    paymentChannelId: number,
  ) {
    try {
      const redisKey = `product_plan_pricing:${name}:${paymentChannelId}:${pricingAmount}`;
      const cache = await this.redis.get(redisKey);

      if (cache) {
        return cache;
      }

      const productWithPlan =
        await this.productRepo.findProductWithPlanAndPricing(
          name,
          paymentChannelId,
          pricingAmount,
        );

      if (!productWithPlan) {
        throw Error('Plan was not found');
      }

      this.redis.set(redisKey, productWithPlan);
    } catch (error) {
      throw error;
    }
  }
}
