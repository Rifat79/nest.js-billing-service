import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  GpChargeConfig,
  GpPaymentService,
} from 'src/payment/gp.payment.service';
import { SubscriptionData } from 'src/subscription/subscription.service';
import { CallbackStrategy } from '../interfaces/callback-strategy.interface';

export interface GpCallbackQuery {
  status: string;
  customerReference: string;
  consentId: string;
  reason?: string;
}

@Injectable()
export class GpCallbackStrategy implements CallbackStrategy {
  private subscriptionData: SubscriptionData;

  constructor(
    private readonly logger: PinoLogger,
    private readonly gpPaymentService: GpPaymentService,
  ) {
    this.logger.setContext(GpCallbackStrategy.name);
  }

  withContext({
    subscriptionData,
  }: {
    subscriptionData: SubscriptionData;
  }): this {
    this.subscriptionData = subscriptionData;
    return this;
  }

  async handle(query: GpCallbackQuery): Promise<{ redirectUrl: string }> {
    const { initialPaymentAmount, urls, subscription_id, durationCountDays } =
      this.subscriptionData;
    const { status, customerReference, consentId, reason } = query;
    const chargeConfig = this.subscriptionData.chargeConfig as GpChargeConfig;

    if (status === 'cancel') {
      return {
        redirectUrl: urls.deny,
        status: 'CONSENT_REJECTED',
        remarks: reason,
      };
    }

    if (status === 'fail') {
      return {
        redirectUrl: urls.error,
        status: 'CONSENT_FAILED',
        remarks: reason,
      };
    }

    const chargePayload = {
      customerReference,
      consentId,
      subscriptionId: subscription_id,
      validity: durationCountDays,
      amount: initialPaymentAmount,
      chargeConfig,
    };

    const response =
      await this.gpPaymentService.chargeWithConsent(chargePayload);

    if (response.success) {
      return {
        redirectUrl: urls.success,
        status: 'ACTIVE',
        remarks: '',
      };
    }

    if (response.messageId === 'POL1000') {
      // Low balance; init recharge and buy
      const rechargeResponse = await this.gpPaymentService.initRechargeAndBuy({
        paymentReference: crypto.randomUUID(),
        originalPaymentReference: subscription_id,
        customerReference,
        successUrl: urls.success,
        errorUrl: urls.error,
        denyUrl: urls.deny,
      });

      if (rechargeResponse?.success) {
        return {
          redirectUrl: rechargeResponse.url,
          status: 'PENDING_ACTIVATION',
          remarks: '',
        };
      }
    }

    return {
      redirectUrl: urls.error,
      status: 'ACTIVATION_FAILED',
      remarks: '',
    };
  }
}
