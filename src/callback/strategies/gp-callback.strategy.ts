import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  RedirectionStatus,
  SubscriptionStatus,
} from 'src/common/enums/subscription.enums';
import {
  GpChargeConfig,
  GpChargePayload,
  GpErrorCode,
  GpPaymentService,
} from 'src/payment/gp.payment.service';
import { SubscriptionData } from 'src/subscription/subscription.service';
import { CallbackStrategy } from '../interfaces/callback-strategy.interface';
import { CallbackResult } from '../interfaces/callback.interface';

export interface GpCallbackQuery {
  status: RedirectionStatus;
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

  async handle(query: GpCallbackQuery): Promise<CallbackResult> {
    const { initialPaymentAmount, urls, subscription_id, durationCountDays } =
      this.subscriptionData;
    const { status, customerReference, consentId, reason } = query;
    const chargeConfig = this.subscriptionData.chargeConfig as GpChargeConfig;

    this.logger.info(
      { subscriptionId: subscription_id, status },
      'Received GP callback',
    );

    if (status === RedirectionStatus.CANCEL) {
      return {
        redirectUrl: urls.deny,
        status: SubscriptionStatus.CONSENT_REJECTED,
        remarks: reason,
      };
    }

    if (status === RedirectionStatus.FAIL) {
      return {
        redirectUrl: urls.error,
        status: SubscriptionStatus.CONSENT_FAILED,
        remarks: reason,
      };
    }

    const chargePayload: GpChargePayload = {
      customerReference,
      consentId,
      subscriptionId: subscription_id,
      validity: durationCountDays,
      amount: initialPaymentAmount,
      chargeConfig,
      channel: null,
    };

    const response =
      await this.gpPaymentService.chargeWithConsent(chargePayload);

    const billingContext = {
      requestPayload: chargePayload,
      response: {
        code: response.messageId,
        message: response.messageText,
        payload: response.responsePayload,
        duration: response.duration,
      },
    };

    if (response.success) {
      return {
        redirectUrl: urls.success,
        status: SubscriptionStatus.ACTIVE,
        billingContext,
      };
    }

    if (response.messageId === GpErrorCode.INSUFFICIENT_BALANCE) {
      this.logger.info(
        { subscriptionId: subscription_id },
        'Low balance detected, initiating recharge',
      );

      const rechargeUrl = await this.gpPaymentService.initRechargeAndBuy({
        paymentReference: crypto.randomUUID(),
        originalPaymentReference: subscription_id,
        customerReference,
        successUrl: urls.success,
        errorUrl: urls.error,
        denyUrl: urls.deny,
      });

      if (rechargeUrl) {
        return {
          redirectUrl: rechargeUrl,
        };
      }
    }

    this.logger.error(
      { subscriptionId: subscription_id },
      'GP activation failed',
    );
    return {
      redirectUrl: urls.error,
      status: SubscriptionStatus.ACTIVATION_FAILED,
      billingContext,
    };
  }
}
