import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PlanNotFoundException } from 'src/common/exceptions/product.exceptions';
import { RedisService } from 'src/common/redis/redis.service';
import {
  ProductRepository,
  ProductWithPlanAndPricing,
} from 'src/database/product.repository';

@Injectable()
export class ProductService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
    private readonly productRepo: ProductRepository,
  ) {
    this.logger.setContext(ProductService.name);
  }

  async getProductPlanWithPricing(
    name: string,
    pricingAmount: number,
    paymentChannelId: number,
  ): Promise<ProductWithPlanAndPricing> {
    const redisKey = `product_plan_pricing:${name}:${paymentChannelId}:${pricingAmount}`;

    try {
      const cached = await this.redis.get<ProductWithPlanAndPricing>(redisKey);
      if (cached) {
        this.logger.debug({ redisKey }, 'Cache hit for product plan pricing');
        return cached;
      }

      const productWithPlan =
        await this.productRepo.findProductWithPlanAndPricing(
          name,
          paymentChannelId,
          pricingAmount,
        );

      if (!productWithPlan) {
        this.logger.warn(
          { name, paymentChannelId, pricingAmount },
          'Product plan not found',
        );
        throw new PlanNotFoundException(name, paymentChannelId, pricingAmount);
      }

      await this.redis.set(redisKey, productWithPlan);
      this.logger.debug({ redisKey }, 'Product plan cached');

      return productWithPlan;
    } catch (error) {
      this.logger.error(
        {
          name,
          paymentChannelId,
          pricingAmount,
          error: error instanceof Error ? error.message : error,
        },
        'Error retrieving product plan with pricing',
      );
      throw error;
    }
  }
}
