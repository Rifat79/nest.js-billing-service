import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  BillingEvent,
  BillingEventRepository,
} from 'src/database/billing-event.repository';

export interface BillingEventSubscriptionData {
  merchant_id: number;
  product_id: number;
  plan_id: number;
  plan_pricing_id: number;
  subscription_id: string;
  payment_channel_id: number;
  msisdn: string;
  charging_configuration_id: number;
  payment_reference_id?: string;
}

@Injectable()
export class BillingEventService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly billingEventRepo: BillingEventRepository,
  ) {
    this.logger.setContext(BillingEventService.name);
  }

  buildBillingEventLog({
    subscriptionData,
    eventType,
    status,
    amount,
    currency,
    requestPayload,
    response,
    duration,
  }: {
    subscriptionData: BillingEventSubscriptionData;
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
      payment_reference_id:
        subscriptionData.payment_reference_id ??
        subscriptionData.subscription_id,
      event_type: eventType,
      status,
      amount,
      currency,
      request_payload: { requestPayload },
      response_code: response.code ?? '',
      response_message: response.message ?? '',
      response_payload: { responsePayload: response.payload },
      duration,
      created_at: new Date().toISOString(),
    };
  }

  async persistBillingEvents(data: BillingEvent[]): Promise<void> {
    await this.billingEventRepo.createBatch(data);
  }
}
