import { Injectable } from '@nestjs/common';
import { subscription_status } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from 'src/common/redis/redis.service';
import { PaymentService } from 'src/payment/payment.service';
import { ProductService } from 'src/product/product.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

export interface SubscriptionData {
  subscription_id: string;
  msisdn: string;
  payment_channel_id: number;
  merchant_id: number;
  product_id: number;
  plan_id: number;
  plan_pricing_id: number;
  merchant_transaction_id: string;
  status: subscription_status;
  auto_renew: boolean;
  payment_channel_reference_id?: string;
  created_at: Date;
  updated_at: Date;

  // Extra fields for processing later
  urls: {
    success: string;
    deny: string;
    error: string;
  };
  paymentProvider: string;
  initialPaymentAmount: number;
  chargeConfig: Record<string, any>;
  durationCountDays: number;
}

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
  ): Promise<{ url: string; subscriptionId: string }> {
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
        durationCountDays: product.product_plans[0].billing_cycle_days,
        paymentChannelId: paymentChannel.id,
        productId: product.id,
        planId: product.product_plans[0].id,
      };

      const { url, aocTransID, sessionKey, chargeConfig } =
        await this.paymentService.getChargingUrl(getChargeUrlPayload);

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
        auto_renew: product.product_plans[0].billing_model === 'RECURRING',
        ...(aocTransID && { payment_channel_reference_id: aocTransID }),
        created_at: new Date(),
        updated_at: new Date(),
        // INFO: Extra fields(added for processing later)
        urls,
        paymentProvider,
        initialPaymentAmount: getChargeUrlPayload.initialPaymentAmount,
        chargeConfig,
        durationCountDays: product.product_plans[0].billing_cycle_days,
      };
      await this.redis.set(`subscriptions:${subscriptionId}`, subscriptionData);

      return { url, subscriptionId };
    } catch (error) {
      this.logger.error(error, 'Catch block error in createSubscription');
      throw error;
    }
  }

  async getCachedSubscription(subscriptionId: string) {
    return this.redis.get<SubscriptionData>(`subscriptions:${subscriptionId}`);
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
