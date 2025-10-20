import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from 'src/common/redis/redis.service';
import { PaymentService } from 'src/payment/payment.service';
import { ProductService } from 'src/product/product.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly productService: ProductService,
    private readonly paymentService: PaymentService,
    private readonly redis: RedisService,
  ) {}

  async createSubscription(
    data: CreateSubscriptionDto,
  ): Promise<{ url: string }> {
    try {
      const { msisdn, transactionId, urls, paymentProvider, keyword, amount } =
        data.body;

      const paymentChannel =
        await this.paymentService.getPaymentChannel(paymentProvider);

      if (!paymentChannel) {
        throw new Error('payment channel was not found');
      }

      const product = await this.productService.getProductPlanWithPricing(
        keyword,
        amount,
        paymentChannel.id,
      );

      if (!product) {
        throw new Error('product was not found');
      }

      const subscriptionId = this.generateSubscriptionId();

      const getChargeUrlPayload = {
        msisdn,
        amount,
        paymentProvider,
        subscriptionId,
        productDescription:
          product.description ??
          product.name +
            '_' +
            product.product_plans[0].billing_frequency.toUpperCase(),
        initialPaymentAmount: this.getInitialPaymentAmount(
          product.product_plans[0].plan_pricing[0].promotion_start_date,
          product.product_plans[0].plan_pricing[0].promotion_end_date,
          product.product_plans[0].plan_pricing[0].promotional_price?.toNumber() ??
            null,
          amount,
        ),
        currency: product.product_plans[0].plan_pricing[0].currency,
        productName: product.name,
        durationCountDays: product.product_plans[0].billing_cycle_days,
      };

      const url = await this.paymentService.getChargingUrl(getChargeUrlPayload);

      const subscriptionData = {
        subscription_id: subscriptionId,
        msisdn,
        payment_channel_id: paymentChannel.id,
        merchant_id: product.merchant_id,
        product_id: product.id,
        plan_id: product.product_plans[0].id,
        plan_pricing_id: product.product_plans[0].plan_pricing[0].id,
        merchant_transaction_id: transactionId,
        status: 'PENDING_CONSENT',
        auto_renew: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      await this.redis.set(`subscriptions:${subscriptionId}`, subscriptionData);

      return url;
    } catch (error) {
      this.logger.error(error, 'Catch block error in createSubscription');
      throw error;
    }
  }

  // async cancelSubscription() {
  //   return 0;
  // }

  private generateSubscriptionId() {
    return uuidv4();
  }

  private getInitialPaymentAmount(
    promoStartDate: Date | null,
    promoEndDate: Date | null,
    promotionalPricing: number | null,
    baseAmount: number,
  ): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (
      promoStartDate &&
      promoEndDate &&
      promotionalPricing != null &&
      today >= promoStartDate &&
      today <= promoEndDate
    ) {
      return promotionalPricing;
    }

    return baseAmount;
  }
}
