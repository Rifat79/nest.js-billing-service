import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { BillingEventService } from 'src/billing-event/billing-event.service';
import { PaymentProvider } from 'src/common/enums/payment-providers';
import { SubscriptionStatus } from 'src/common/enums/subscription.enums';
import { RedisService } from 'src/common/redis/redis.service';
import { EventPublisherService } from 'src/event-publisher/event-publisher.service';
import {
  SubscriptionData,
  SubscriptionsService,
} from 'src/subscription/subscription.service';

// Key/value entries inside requestParam.data[]
export interface BLWebhookDataItem {
  name: string;
  value: string;
}

export enum BlWebhookCommand {
  ACTIVATION = 'NotifyActivation',
  RENEWAL = 'NotifyRenewal',
  DEACTIVATION = 'NotifyDeActivation',
}

export enum BlWebhookSubscriptionStatus {
  ACTIVE = 'A',
  GRACE = 'G',
  SUSPENDED = 'S',
  DEACTIVATED = 'D',
}

// requestParam object (varies by command)
export interface BLWebhookRequestParam {
  data: BLWebhookDataItem[];
  command: BlWebhookCommand;
  subscriptionOfferID?: string;
  planId?: string;
}

// Main webhook body from Banglalink
export interface BLWebhookBody {
  requestId: string;
  requestTimeStamp: string;
  channel: string;
  requestParam: BLWebhookRequestParam;
  msisdn: string;
  featureId: string;
}

interface ExtractedPayload {
  msisdn: string;
  command: BlWebhookCommand;
  subscriptionStatus: string;
  offerId: string;
  requestId?: string;
}

@Injectable()
export class BanglalinkWebhookService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
    private readonly subscriptionService: SubscriptionsService,
    private readonly billingEventService: BillingEventService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  extractPayload(payload: BLWebhookBody): ExtractedPayload {
    const { msisdn } = payload;
    const { command } = payload.requestParam;

    const subscriptionStatus =
      payload.requestParam.data.find(
        (item) => item.name === 'SubscriptionStatus',
      )?.value || '';

    const offerId =
      payload.requestParam.subscriptionOfferID ??
      (payload.requestParam.data.find((item) => item.name === 'OfferCode')
        ?.value ||
        '');

    return {
      msisdn,
      command,
      subscriptionStatus,
      offerId,
    };
  }

  async handleActivation(payload: Omit<ExtractedPayload, 'command'>) {
    const { msisdn, subscriptionStatus, offerId } = payload;

    const subscriptionData = await this.redis.get<SubscriptionData>(
      `subscriptions:${PaymentProvider.BANGLALINK}:${msisdn}:${offerId}`,
    );

    if (!subscriptionData) {
      this.logger.warn(`No subscription data found for ${msisdn} / ${offerId}`);
      return;
    }

    // Determine variables based on the webhook status
    let newSubscriptionStatus: SubscriptionStatus;
    let billingEventType: 'subscription.success' | 'subscription.failed';
    let notificationEventType: 'subscription.success' | 'subscription.fail';
    let billingStatus: 'SUCCEEDED' | 'FAILED';
    let nextBillingAt: Date | undefined;

    switch (subscriptionStatus as BlWebhookSubscriptionStatus) {
      case BlWebhookSubscriptionStatus.ACTIVE: {
        newSubscriptionStatus = SubscriptionStatus.ACTIVE;
        billingEventType = 'subscription.success';
        notificationEventType = 'subscription.success';
        billingStatus = 'SUCCEEDED';
        const nextBillingTimestamp =
          Date.now() + subscriptionData.durationCountDays * 24 * 60 * 60 * 1000;
        nextBillingAt = new Date(nextBillingTimestamp);
        break;
      }

      case BlWebhookSubscriptionStatus.GRACE:
      case BlWebhookSubscriptionStatus.SUSPENDED: {
        newSubscriptionStatus = SubscriptionStatus.GRACE;
        billingEventType = 'subscription.failed';
        notificationEventType = 'subscription.fail';
        billingStatus = 'FAILED';
        break;
      }

      case BlWebhookSubscriptionStatus.DEACTIVATED: {
        // Note: This often means activation failed immediately and subscription is dead.
        newSubscriptionStatus = SubscriptionStatus.ACTIVATION_FAILED;
        billingEventType = 'subscription.failed';
        notificationEventType = 'subscription.fail';
        billingStatus = 'FAILED';
        break;
      }

      default:
        this.logger.warn(
          `Unhandled subscription status: ${subscriptionStatus} for ${msisdn}`,
        );
        return;
    }

    // --- Centralized Event Persistence and Notification ---

    // 1. Persist Subscription Event
    await this.subscriptionService.persistSubscriptionEvents([
      {
        ...subscriptionData,
        status: newSubscriptionStatus,
        next_billing_at: nextBillingAt,
      },
    ]);

    // 2. Build and Persist Billing Event
    const billingEvent = this.billingEventService.buildBillingEventLog({
      subscriptionData,
      eventType: billingEventType,
      status: billingStatus,
      amount: subscriptionData.initialPaymentAmount,
      currency: subscriptionData.currency ?? 'BDT',
      requestPayload: payload,
      response: {},
      duration: 0,
    });

    await this.subscriptionService.persistBillingEvents([billingEvent]);

    // 3. Publish Notification Event
    await this.eventPublisher.sendNotification({
      id: crypto.randomUUID(),
      source: 'dcb-billing-service',
      subscriptionId: subscriptionData.subscription_id,
      merchantTransactionId: subscriptionData.merchant_transaction_id,
      keyword: subscriptionData.keyword,
      msisdn: subscriptionData.msisdn,
      paymentProvider: subscriptionData.paymentProvider,
      amount: subscriptionData.initialPaymentAmount,
      currency: subscriptionData.currency,
      billingCycleDays: subscriptionData.durationCountDays,
      eventType: notificationEventType,
      timestamp: Date.now(),
    });

    return;
  }

  async handleRenewal(payload: Omit<ExtractedPayload, 'command'>) {
    const { msisdn, subscriptionStatus, offerId } = payload;

    const subscription = await this.subscriptionService.findByMsisdnOfferCode(
      msisdn,
      offerId,
    );

    if (!subscription) {
      this.logger.warn(`No subscription data found for ${msisdn} / ${offerId}`);
      return;
    }

    let newSubscriptionStatus: SubscriptionStatus;
    let billingEventType:
      | 'renew.success'
      | 'renew.fail'
      | 'subscription.suspend';
    let notificationEventType:
      | 'renew.success'
      | 'renew.fail'
      | 'subscription.suspend';
    let billingStatus: 'SUCCEEDED' | 'FAILED';
    let nextBillingAt: Date | undefined;
    const paymentAmount =
      subscription.plan_pricing?.base_amount.toNumber() ?? 0;

    switch (subscriptionStatus as BlWebhookSubscriptionStatus) {
      case BlWebhookSubscriptionStatus.ACTIVE: {
        // Successful renewal
        newSubscriptionStatus = SubscriptionStatus.ACTIVE;
        billingEventType = 'renew.success';
        notificationEventType = 'renew.success';
        billingStatus = 'SUCCEEDED';
        // Calculate next billing date
        const nextBillingTimestamp =
          Date.now() +
          subscription.product_plans.billing_cycle_days * 24 * 60 * 60 * 1000;
        nextBillingAt = new Date(nextBillingTimestamp);
        break;
      }

      case BlWebhookSubscriptionStatus.GRACE:
      case BlWebhookSubscriptionStatus.SUSPENDED: {
        // Unified logic for failed renewal (Grace or Suspended)
        newSubscriptionStatus = SubscriptionStatus.GRACE; // Mapping both to GRACE
        billingEventType = 'renew.fail';
        notificationEventType = 'renew.fail';
        billingStatus = 'FAILED';
        break;
      }

      case BlWebhookSubscriptionStatus.DEACTIVATED: {
        // Renewal failed and led to deactivation
        newSubscriptionStatus = SubscriptionStatus.SUSPENDED;
        billingEventType = 'renew.fail'; // The charge failed
        notificationEventType = 'subscription.suspend'; // The final event is deactivation
        billingStatus = 'FAILED';
        break;
      }

      default:
        this.logger.warn(
          `Unhandled renewal subscription status: ${subscriptionStatus} for ${msisdn}`,
        );
        return;
    }

    // --- Centralized Event Persistence and Notification ---

    // 1. Persist Subscription Event
    await this.subscriptionService.updateStatus(
      subscription.subscription_id,
      newSubscriptionStatus,
      nextBillingAt,
      newSubscriptionStatus === SubscriptionStatus.SUSPENDED
        ? 'Stopped from system'
        : '',
    );

    // 2. Build and Persist Billing Event
    const subscriptionData = {
      merchant_id: subscription.merchant_id,
      product_id: subscription.product_id,
      plan_id: subscription.plan_id,
      plan_pricing_id: subscription.plan_pricing_id ?? 0,
      subscription_id: subscription.subscription_id,
      payment_channel_id: subscription.payment_channel_id,
      msisdn: subscription.msisdn,
      payment_reference_id: payload.requestId ?? subscription.subscription_id,
      charging_configuration_id: subscription.charging_configuration_id ?? 0,
    };

    const billingEvent = this.billingEventService.buildBillingEventLog({
      subscriptionData,
      eventType: billingEventType,
      status: billingStatus,
      amount: paymentAmount,
      currency: subscription.plan_pricing?.currency ?? 'BDT',
      requestPayload: payload,
      response: {},
      duration: 0,
    });

    await this.subscriptionService.persistBillingEvents([billingEvent]);

    // 3. Publish Notification Event
    await this.eventPublisher.sendNotification({
      id: crypto.randomUUID(),
      source: 'dcb-billing-service',
      subscriptionId: subscription.subscription_id,
      merchantTransactionId: subscription.merchant_transaction_id,
      keyword: subscription.products.name,
      msisdn: subscription.msisdn,
      paymentProvider: subscription.payment_channels.code,
      amount: paymentAmount,
      currency: subscription.plan_pricing?.currency ?? 'BDT',
      billingCycleDays: subscription.product_plans.billing_cycle_days,
      eventType: notificationEventType,
      timestamp: Date.now(),
    });

    return;
  }

  async handleDeactivation(payload: Omit<ExtractedPayload, 'command'>) {
    const { msisdn, offerId } = payload;

    const subscription = await this.subscriptionService.findByMsisdnOfferCode(
      msisdn,
      offerId,
    );

    if (!subscription) {
      this.logger.warn(`No subscription data found for ${msisdn} / ${offerId}`);
      return;
    }

    // 1. Persist Subscription Event
    await this.subscriptionService.updateStatus(
      subscription.subscription_id,
      SubscriptionStatus.SUSPENDED,
      null,
      'Webhook NotifyDeActivation command received',
    );

    // 2. Publish Notification Event
    await this.eventPublisher.sendNotification({
      id: crypto.randomUUID(),
      source: 'dcb-billing-service',
      subscriptionId: subscription.subscription_id,
      merchantTransactionId: subscription.merchant_transaction_id,
      keyword: subscription.products.name,
      msisdn: subscription.msisdn,
      paymentProvider: subscription.payment_channels.code,
      amount: subscription.plan_pricing?.base_amount.toNumber() ?? 0,
      currency: subscription.plan_pricing?.currency ?? 'BDT',
      billingCycleDays: subscription.product_plans.billing_cycle_days,
      eventType: 'subscription.suspend',
      timestamp: Date.now(),
    });

    return;
  }
}
