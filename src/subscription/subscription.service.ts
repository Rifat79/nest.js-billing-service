import { Injectable } from '@nestjs/common';
import { subscription_status } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PaymentProvider } from 'src/common/enums/payment-providers';
import { SubscriptionStatus } from 'src/common/enums/subscription.enums';
import {
  CancellationStrategyNotFoundException,
  SubscriptionNotFoundException,
} from 'src/common/exceptions';
import { RedisService } from 'src/common/redis/redis.service';
import {
  BillingEvent,
  BillingEventRepository,
} from 'src/database/billing-event.repository';
import {
  SubscriptionDetails,
  SubscriptionRepository,
  SubscriptionsCreateInput,
} from 'src/database/subscription.repository';
import { EventPublisherService } from 'src/event-publisher/event-publisher.service';
import { BanglalinkChargeConfig } from 'src/payment/banglalink.payment.service';
import { BkashChargeConfig } from 'src/payment/bkash.payment.service';
import { PaymentService } from 'src/payment/payment.service';
import { RobiChargeConfig } from 'src/payment/robi.payment.service';
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
  consent_id?: string;
  consent_timestamp?: Date;
  remarks?: string | null;
  next_billing_at?: Date | null;
  charging_configuration_id: number;
  created_at: Date;
  updated_at: Date;

  // Extra fields for processing later
  keyword: string;
  urls: {
    success: string;
    deny: string;
    error: string;
  };
  paymentProvider: PaymentProvider;
  initialPaymentAmount: number;
  currency: string;
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
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly billingEventRepo: BillingEventRepository,
    private readonly eventPublisher: EventPublisherService,
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
        charging_configuration_id: chargeConfig.id,
        created_at: new Date(),
        updated_at: new Date(),
        // INFO: Extra fields(added for processing later)
        keyword,
        urls,
        paymentProvider,
        initialPaymentAmount: getChargeUrlPayload.initialPaymentAmount,
        currency: product.product_plans[0].plan_pricing[0].currency,
        chargeConfig: chargeConfig.config,
        durationCountDays: product.product_plans[0].billing_cycle_days,
      };

      await this.redis.set(`subscriptions:${subscriptionId}`, subscriptionData);

      if (paymentProvider === PaymentProvider.BANGLALINK) {
        const provider = PaymentProvider.BANGLALINK;
        const chargeCode = (
          chargeConfig.config as unknown as BanglalinkChargeConfig
        ).chargeCode;

        await this.redis.set(
          `subscriptions:${provider}:${msisdn}:${chargeCode}`,
          subscriptionData,
          3600,
        );
      }

      return { url, subscriptionId };
    } catch (error) {
      this.logger.error(error, 'Catch block error in createSubscription');
      throw error;
    }
  }

  async getCachedSubscription(subscriptionId: string) {
    return this.redis.get<SubscriptionData>(`subscriptions:${subscriptionId}`);
  }

  async persistSubscriptionEvents(data: SubscriptionData[]): Promise<void> {
    const prismaBatchData: SubscriptionsCreateInput[] = data.map((item) => ({
      subscription_id: item.subscription_id,
      msisdn: item.msisdn,
      payment_channel_id: item.payment_channel_id,
      merchant_id: item.merchant_id,
      product_id: item.product_id,
      plan_id: item.plan_id,
      plan_pricing_id: item.plan_pricing_id,
      merchant_transaction_id: item.merchant_transaction_id,
      status: item.status,
      auto_renew: item.auto_renew,
      payment_channel_reference_id: item.payment_channel_reference_id,
      consent_id: item.consent_id,
      consent_timestamp: item.consent_timestamp,
      next_billing_at: item.next_billing_at,
      remarks: item.remarks,
      payment_success_count: 1,
      charging_configuration_id: item.charging_configuration_id,
      created_at: item.created_at,
      updated_at: item.updated_at,

      // ⚠️ Important: Omit all extra fields (keyword, urls, paymentProvider, etc.)
      // and all relation fields (payment_channels, merchants, etc.).
    }));

    await this.subscriptionRepo.createBatch(prismaBatchData);
  }

  async persistBillingEvents(data: BillingEvent[]): Promise<void> {
    await this.billingEventRepo.createBatch(data);
  }

  async cancelSubscription(data: {
    subscriptionId: string;
    msisdn: string;
    transactionId: string;
  }): Promise<{
    success: boolean;
    message: string;
    statusCode: number;
    subscriptionId?: string;
  }> {
    const { msisdn, transactionId, subscriptionId } = data;
    const traceId = `cancel-subscription-${subscriptionId ?? transactionId}`;

    let subscriptionData: SubscriptionDetails | null = null;

    if (subscriptionId) {
      subscriptionData =
        await this.subscriptionRepo.findSubscriptionDetails(subscriptionId);
    }

    if (!subscriptionData && msisdn && transactionId) {
      subscriptionData =
        await this.subscriptionRepo.findFirstDynamic<SubscriptionDetails>({
          where: {
            msisdn,
            merchant_transaction_id: transactionId,
          },
          include: {
            payment_channels: true,
            plan_pricing: true,
            charging_configurations: true,
            products: true,
            product_plans: true,
          },
        });
    }

    if (!subscriptionData) {
      throw new SubscriptionNotFoundException(subscriptionId ?? transactionId);
    }

    if (
      !subscriptionData.charging_configurations ||
      !subscriptionData.plan_pricing
    ) {
      this.logger.warn({ traceId }, 'Missing charge config or pricing');
      return {
        success: false,
        message: 'Incomplete subscription data for cancellation',
        statusCode: 500,
        subscriptionId: subscriptionData.subscription_id,
      };
    }

    if (
      (subscriptionData.status as SubscriptionStatus) !==
        SubscriptionStatus.ACTIVE &&
      (subscriptionData.status as SubscriptionStatus) !==
        SubscriptionStatus.GRACE
    ) {
      return {
        success: false,
        message: `Could not cancel subscription for status: ${subscriptionData.status}`,
        statusCode: 403,
        subscriptionId: subscriptionData.subscription_id,
      };
    }

    const provider = subscriptionData.payment_channels.code;

    // Map of strategy functions
    const cancellationStrategies: Record<string, () => Promise<boolean>> = {
      GP: async () => {
        return await this.paymentService.gpInvalidateAcr(
          subscriptionData.payment_channel_reference_id ?? '#',
        );
      },
      BL: async () => {
        return await this.paymentService.blInitDeactivation({
          amount: subscriptionData.plan_pricing?.base_amount?.toNumber() ?? 0,
          requestId: subscriptionData.subscription_id,
          msisdn: subscriptionData.msisdn,
          chargeConfig: subscriptionData.charging_configurations
            ?.config as unknown as BanglalinkChargeConfig,
        });
      },
      ROBI: async () => {
        return await this.paymentService.robiCancelAocToken({
          subscriptionId: subscriptionData.subscription_id,
          msisdn: subscriptionData.msisdn,
          config: subscriptionData.charging_configurations
            ?.config as unknown as RobiChargeConfig,
        });
      },
      BKASH: async () => {
        return await this.paymentService.bkashCancelSubscription({
          paymentChannelReferenceId: String(
            subscriptionData.payment_channel_reference_id,
          ),
          config: subscriptionData.charging_configurations
            ?.config as unknown as BkashChargeConfig,
        });
      },
    };

    const strategy = cancellationStrategies[provider];

    if (!strategy) {
      throw new CancellationStrategyNotFoundException(provider);
    }

    const executeCancellationStrategy = async (
      provider: string,
      strategy: () => Promise<boolean>,
    ): Promise<boolean> => {
      try {
        this.logger.info(
          { traceId, provider },
          'Executing cancellation strategy',
        );
        return await strategy();
      } catch (error) {
        this.logger.error(
          { traceId, provider, error },
          'Cancellation strategy failed',
        );
        return false;
      }
    };

    const isSuccessful = await executeCancellationStrategy(provider, strategy);

    this.logger.info(
      {
        traceId,
        subscriptionId: subscriptionData.subscription_id,
        provider,
        success: isSuccessful,
      },
      'Cancellation attempt completed',
    );

    if (isSuccessful) {
      const updated = await this.subscriptionRepo.update(
        {
          subscription_id: subscriptionData.subscription_id,
        },
        {
          status: SubscriptionStatus.CANCELLED,
          auto_renew: false,
          remarks: 'Unsubscribed by user',
        },
      );

      if (!updated) {
        this.logger.warn({ traceId }, 'Subscription update failed');
        return {
          success: false,
          message: 'Failed to update subscription status',
          statusCode: 500,
          subscriptionId: subscriptionData.subscription_id,
        };
      }

      await this.eventPublisher.sendNotification({
        id: uuidv4(),
        source: 'dcb-billing-service',
        subscriptionId: subscriptionData.subscription_id,
        merchantTransactionId: subscriptionData.merchant_transaction_id,
        keyword: subscriptionData.products.name,
        msisdn: subscriptionData.msisdn,
        paymentProvider: subscriptionData.payment_channels.code,
        eventType: 'subscription.cancel',
        amount: subscriptionData.plan_pricing?.base_amount.toNumber() ?? 0,
        currency: subscriptionData.plan_pricing?.currency ?? 'BDT',
        billingCycleDays: subscriptionData.product_plans.billing_cycle_days,
        timestamp: Date.now(),
      });

      return {
        success: true,
        message: 'Subscription has been cancelled successfully',
        statusCode: 200,
      };
    }

    return {
      success: false,
      message: 'Could not cancel the subscription',
      statusCode: 502,
      subscriptionId: subscriptionData.subscription_id,
    };
  }

  async findByMsisdnOfferCode(
    msisdn: string,
    offerCode: string,
  ): Promise<SubscriptionDetails | null> {
    return await this.subscriptionRepo.findFirstDynamic({
      where: {
        msisdn,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE],
        },
        charging_configurations: {
          is: {
            config: {
              path: ['offerCode'],
              equals: offerCode,
            },
          },
        },
      },
      include: {
        charging_configurations: true,
        payment_channels: true,
        plan_pricing: true,
        products: true,
        product_plans: true,
      },
    });
  }

  async updateStatus(
    subscriptionId: string,
    status: SubscriptionStatus,
    nextBillingAt?: Date | null,
    remarks?: string | null,
  ) {
    return await this.subscriptionRepo.update(
      {
        subscription_id: subscriptionId,
      },
      {
        status,
        updated_at: new Date(),
        remarks: remarks ?? '',
        ...(nextBillingAt ? { next_billing_at: nextBillingAt } : {}),
      },
    );
  }

  async getSubscriptionDetails(subscriptionId: string) {
    return await this.subscriptionRepo.findSubscriptionDetails(subscriptionId);
  }

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
