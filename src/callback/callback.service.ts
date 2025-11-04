import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PaymentProvider } from 'src/common/enums/payment-providers';
import {
  SubscriptionEvent,
  SubscriptionStatus,
} from 'src/common/enums/subscription.enums';
import { SubscriptionNotFoundException } from 'src/common/exceptions';
import {
  BILLING_EVENT_LOG_QUEUE,
  SUBSCRIPTION_POST_CONSENT_QUEUE,
} from 'src/common/redis/redis.constants';
import { RedisService } from 'src/common/redis/redis.service';
import { EventPublisherService } from 'src/event-publisher/event-publisher.service';
import {
  SubscriptionData,
  SubscriptionsService,
} from 'src/subscription/subscription.service';
import { CallbackStrategyFactory } from './callback-strategy.factory';
import { GpCallbackQuery } from './strategies';

@Injectable()
export class CallbackService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly subscriptionService: SubscriptionsService,
    private readonly callbackStrategyFactory: CallbackStrategyFactory,
    private readonly redis: RedisService,
    private readonly eventPublisher: EventPublisherService,
  ) {
    this.logger.setContext(CallbackService.name);
  }

  async resolveUrl(
    subscriptionId: string,
    query: Record<string, any>,
  ): Promise<string> {
    const consentTimestamp = Date.now();

    const subscriptionData =
      await this.subscriptionService.getCachedSubscription(subscriptionId);

    if (!subscriptionData) {
      throw new SubscriptionNotFoundException(subscriptionId);
    }

    const result = await this.callbackStrategyFactory.handleCallback(
      subscriptionData,
      query,
    );

    const { status, remarks } = result;

    // publish to queue and send notification
    if (status) {
      const tasks: Promise<any>[] = [];
      const nextBillingAt =
        Date.now() + subscriptionData.durationCountDays * 24 * 60 * 60 * 1000;

      tasks.push(
        this.redis.rpush(
          SUBSCRIPTION_POST_CONSENT_QUEUE,
          JSON.stringify({
            ...subscriptionData,
            status,
            next_billing_at:
              status === SubscriptionStatus.ACTIVE
                ? new Date(nextBillingAt).toISOString()
                : null,
            consent_id:
              subscriptionData.paymentProvider === PaymentProvider.GRAMEENPHONE
                ? (query as GpCallbackQuery)?.consentId
                : null,
            consent_timestamp: new Date(consentTimestamp).toISOString(),
            remarks,
          }),
        ),
      );

      if (result.billingContext) {
        const billingEvent = this.buildBillingEventLog({
          subscriptionData,
          eventType: subscriptionData.auto_renew
            ? SubscriptionEvent.SUBSCRIPTION_INITIAL
            : SubscriptionEvent.SUBSCRIPTION_ON_DEMAND,
          status:
            result.status === SubscriptionStatus.ACTIVE
              ? 'SUCCEEDED'
              : 'FAILED',
          amount: subscriptionData.initialPaymentAmount,
          currency: subscriptionData.currency ?? 'BDT',
          requestPayload: result.billingContext?.requestPayload,
          response: result.billingContext?.response,
          duration: result.billingContext?.response?.duration ?? 0,
        });

        tasks.push(
          this.redis.rpush(
            BILLING_EVENT_LOG_QUEUE,
            JSON.stringify(billingEvent),
          ),
        );
      }

      tasks.push(
        this.eventPublisher.sendNotification({
          id: crypto.randomUUID(),
          source: 'dcb-billing-service',
          subscriptionId,
          merchantTransactionId: subscriptionData.merchant_transaction_id,
          keyword: subscriptionData.keyword,
          msisdn: subscriptionData.msisdn,
          paymentProvider: subscriptionData.paymentProvider,
          amount: subscriptionData.initialPaymentAmount,
          currency: subscriptionData.currency,
          billingCycleDays: subscriptionData.durationCountDays,
          eventType:
            status === SubscriptionStatus.ACTIVE
              ? 'subscription.success'
              : SubscriptionStatus.CONSENT_REJECTED
                ? 'subscription.cancel'
                : 'subscription.fail',
          timestamp: Date.now(),
        }),
      );

      const results = await Promise.allSettled(tasks);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.logger.warn(
            { error: result.reason, taskIndex: index },
            'CallbackService task failed',
          );
        }
      });
    }

    return result.redirectUrl;
  }

  private buildBillingEventLog({
    subscriptionData,
    eventType,
    status,
    amount,
    currency,
    requestPayload,
    response,
    duration,
  }: {
    subscriptionData: SubscriptionData;
    eventType: string;
    status: string;
    amount: number;
    currency: string;
    requestPayload: any;
    response: { code?: string; message?: string; payload?: any };
    duration: number;
  }) {
    return {
      merchant_id: subscriptionData.merchant_id,
      product_id: subscriptionData.product_id,
      plan_id: subscriptionData.plan_id,
      plan_pricing_id: subscriptionData.plan_pricing_id,
      subscription_id: subscriptionData.subscription_id,
      payment_channel_id: subscriptionData.payment_channel_id,
      msisdn: subscriptionData.msisdn,
      payment_reference_id: subscriptionData.subscription_id,
      event_type: eventType,
      status,
      amount,
      currency,
      request_payload: { requestPayload },
      response_code: response.code,
      response_message: response.message,
      response_payload: { responsePayload: response.payload },
      duration,
      created_at: new Date().toISOString(),
    };
  }
}
