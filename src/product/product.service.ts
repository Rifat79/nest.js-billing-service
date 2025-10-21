import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from 'src/common/redis/redis.service';
import {
  ProductRepository,
  ProductWithPlanAndPricing,
} from 'src/database/product.repository';

class PlanNotFoundException extends RpcException {
  constructor(message: string, status = 404) {
    super({ status, message });
    this.name = 'PlanNotFoundException';
  }
}

@Injectable()
export class ProductService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
    private readonly productRepo: ProductRepository,
  ) {}

  async getProductPlanWithPricing(
    name: string,
    pricingAmount: number,
    paymentChannelId: number,
  ): Promise<ProductWithPlanAndPricing | null> {
    const redisKey = `product_plan_pricing:${name}:${paymentChannelId}:${pricingAmount}`;
    const cache = (await this.redis.get(redisKey)) as ProductWithPlanAndPricing;

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
      throw new PlanNotFoundException('Plan was not found');
    }

    await this.redis.set(redisKey, productWithPlan);

    return productWithPlan;
  }
}
