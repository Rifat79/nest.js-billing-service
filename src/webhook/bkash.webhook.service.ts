import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { BillingEventService } from 'src/billing-event/billing-event.service';
import { SubscriptionStatus } from 'src/common/enums/subscription.enums';
import { SubscriptionNotFoundException } from 'src/common/exceptions';
import { PaymentChannelWebhookRepository } from 'src/database/payment-channel-webhook.repository';
import { EventPublisherService } from 'src/event-publisher/event-publisher.service';
import {
  BkashChargeConfig,
  BkashPaymentService,
} from 'src/payment/bkash.payment.service';
import { SubscriptionsService } from 'src/subscription/subscription.service';

// Common fields shared by all webhook events
interface BkashWebhookBase {
  subscriptionId: number;
  subscriptionRequestId: string;
  subscriptionReference?: string;
  payer: string;
  frequency: 'DAILY' | 'WEEKLY' | 'FIFTEEN_DAYS' | 'THIRTY_DAYS';
  merchantShortCode: string;
  message?: string | null;
}

// 1️⃣ Payment webhook structure
interface BkashPaymentWebhook extends BkashWebhookBase {
  paymentId: number;
  paymentStatus: 'SUCCEEDED_PAYMENT' | 'FAILED_PAYMENT';
  trxId: string;
  trxDate: string;
  dueDate: string;
  nextPaymentDate: string;
  amount: number;
  firstPayment: boolean;
  errorCode?: string | null;
  subscriptionStatus?: undefined; // prevents overlap
}

// 2️⃣ Subscription webhook structure
interface BkashSubscriptionWebhook extends BkashWebhookBase {
  subscriptionStatus: 'SUCCEEDED' | 'CANCELLED' | 'FAILED';
  cancelledBy?: string | null;
  requesterId?: number | null;
  nextPaymentDate?: string;
  amount?: number;
  paymentStatus?: undefined; // prevents overlap
}

// 3️⃣ Union type (the top-level type)
export type BkashWebhook = BkashPaymentWebhook | BkashSubscriptionWebhook;

const STATUS_MAP = {
  SUCCEEDED: 'subscription.success',
  CANCELLED: 'subscription.suspend',
  FAILED: 'subscription.fail',
};

const PAYMENT_STATUS_MAP = {
  SUCCEEDED_PAYMENT: 'renew.success',
  FAILED_PAYMENT: 'renew.fail',
};

@Injectable()
export class BkashWebhookService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly subscriptionService: SubscriptionsService,
    private readonly eventPublisher: EventPublisherService,
    private readonly webhookRepo: PaymentChannelWebhookRepository,
    private readonly bkashPaymentService: BkashPaymentService,
    private readonly billingEventService: BillingEventService,
  ) {
    this.logger.setContext(BkashWebhookService.name);
  }

  async handleSubscriptionEvent(data: BkashSubscriptionWebhook): Promise<void> {
    const { subscriptionRequestId, subscriptionStatus } = data;
    const subscription = await this.subscriptionService.getSubscriptionDetails(
      subscriptionRequestId,
    );

    if (!subscription) {
      throw new SubscriptionNotFoundException(subscriptionRequestId);
    }

    // Process only cancelled events

    if (subscriptionStatus === 'CANCELLED') {
      await this.subscriptionService.updateStatus(
        subscriptionRequestId,
        SubscriptionStatus.SUSPENDED,
        null,
        `Cancelled by ${data.cancelledBy}`,
      );

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
    }

    await this.webhookRepo.create({
      payment_channel: subscription.payment_channels.code,
      event_type: STATUS_MAP[data.subscriptionStatus],
      http_method: '',
      headers: '',
      payload: data as unknown as Prisma.InputJsonValue,
      ip_address: '',
      received_at: new Date(),
      processed_at: new Date(),
      processing_status: 'SUCCEEDED',
      subscriptions: {
        connect: { subscription_id: subscription.subscription_id },
      },
    });

    return;
  }

  async handlePaymentEvent(data: BkashPaymentWebhook) {
    const { subscriptionId, subscriptionRequestId, paymentStatus } = data;

    const subscription = await this.subscriptionService.getSubscriptionDetails(
      subscriptionRequestId,
    );

    if (!subscription) {
      throw new SubscriptionNotFoundException(subscriptionRequestId);
    }

    const paymentList = await this.bkashPaymentService.getPaymentList(
      String(subscriptionId),
      subscription.charging_configurations
        ?.config as unknown as BkashChargeConfig,
    );

    if (!paymentList) {
      this.logger.warn('');
      return;
    }

    const isFirstPayment = paymentList.length === 1;

    if (!isFirstPayment) {
      if (paymentStatus === 'SUCCEEDED_PAYMENT') {
        const nextBillingTimestamp =
          Date.now() +
          subscription.product_plans.billing_cycle_days * 24 * 60 * 60 * 1000;
        const nextBillingAt = new Date(nextBillingTimestamp);
        await this.subscriptionService.updateStatus(
          subscriptionRequestId,
          SubscriptionStatus.ACTIVE,
          nextBillingAt,
        );
      } else if (paymentStatus === 'FAILED_PAYMENT') {
        await this.subscriptionService.updateStatus(
          subscriptionRequestId,
          SubscriptionStatus.GRACE,
        );
      } else {
        this.logger.warn(`Unknown payment status: ${paymentStatus}`);
      }

      const subscriptionData = {
        merchant_id: subscription.merchant_id,
        product_id: subscription.product_id,
        plan_id: subscription.plan_id,
        plan_pricing_id: subscription.plan_pricing_id ?? 0,
        subscription_id: subscription.subscription_id,
        payment_channel_id: subscription.payment_channel_id,
        msisdn: subscription.msisdn,
        payment_reference_id: data.trxId,
        charging_configuration_id: subscription.charging_configuration_id ?? 0,
      };

      const billingEvent = this.billingEventService.buildBillingEventLog({
        subscriptionData,
        eventType: PAYMENT_STATUS_MAP[data.paymentStatus],
        status: data.paymentStatus,
        amount: data.amount,
        currency: subscription.plan_pricing?.currency ?? 'BDT',
        requestPayload: data,
        response: {},
        duration: 0,
      });

      await this.subscriptionService.persistBillingEvents([billingEvent]);
    }

    await this.webhookRepo.create({
      payment_channel: subscription.payment_channels.code,
      event_type: PAYMENT_STATUS_MAP[data.paymentStatus],
      http_method: '',
      headers: '',
      payload: data as unknown as Prisma.InputJsonValue,
      ip_address: '',
      received_at: new Date(),
      processed_at: new Date(),
      processing_status: 'SUCCEEDED',
      subscriptions: {
        connect: { subscription_id: subscription.subscription_id },
      },
    });

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
  }
}
