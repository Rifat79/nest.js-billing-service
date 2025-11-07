import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  RedirectionStatus,
  SubscriptionStatus,
} from 'src/common/enums/subscription.enums';
import {
  BkashChargeConfig,
  BkashPaymentService,
} from 'src/payment/bkash.payment.service';
import { SubscriptionData } from 'src/subscription/subscription.service';
import { CallbackStrategy } from '../interfaces/callback-strategy.interface';
import { CallbackResult } from '../interfaces/callback.interface';

interface BkashCallbackQuery {
  status: RedirectionStatus;
}

@Injectable()
export class BkashCallbackStrategy implements CallbackStrategy {
  private subscriptionData: SubscriptionData;

  constructor(
    private readonly logger: PinoLogger,
    private readonly bkashPaymentService: BkashPaymentService,
  ) {
    this.logger.setContext(BkashCallbackStrategy.name);
  }

  withContext({
    subscriptionData,
  }: {
    subscriptionData: SubscriptionData;
  }): this {
    this.subscriptionData = subscriptionData;
    return this;
  }

  async handle(query: BkashCallbackQuery): Promise<CallbackResult> {
    const { status } = query;
    const {
      urls,
      subscription_id: subscriptionRequestId,
      chargeConfig,
    } = this.subscriptionData;

    if (status === RedirectionStatus.CANCEL) {
      return {
        redirectUrl: urls.deny,
        paymentChannelReferenceId: '',
        status: SubscriptionStatus.CONSENT_REJECTED,
        remarks: '',
      };
    }

    if (status === RedirectionStatus.FAIL) {
      return {
        redirectUrl: urls.error,
        paymentChannelReferenceId: '',
        status: SubscriptionStatus.CONSENT_FAILED,
        remarks: '',
      };
    }

    const paymentStatusRes =
      await this.bkashPaymentService.queryPaymentStatusWithRequestId(
        subscriptionRequestId,
        chargeConfig as BkashChargeConfig,
      );

    if (!paymentStatusRes) {
      return {
        redirectUrl: urls.error,
        paymentChannelReferenceId: '',
        status: SubscriptionStatus.CONSENT_FAILED,
        remarks: '',
      };
    }
    const { status: paymentStatus, id: paymentChannelReferenceId } =
      paymentStatusRes;

    if (
      !paymentStatus ||
      !['SUCCEEDED', 'VERIFIED'].includes(paymentStatus?.toUpperCase())
    ) {
      this.logger.warn({
        msg: 'Bkash payment status not successful',
        subscriptionId: subscriptionRequestId,
        status: paymentStatus ?? 'UNKNOWN',
      });

      return {
        redirectUrl: urls.error,
        paymentChannelReferenceId: String(paymentChannelReferenceId),
        status: SubscriptionStatus.ACTIVATION_FAILED,
        remarks: paymentStatus ?? 'MISSING_STATUS',
      };
    }

    this.logger.info({
      msg: 'Bkash payment verified',
      subscriptionId: subscriptionRequestId,
      status: paymentStatus,
    });

    return {
      redirectUrl: urls.success,
      paymentChannelReferenceId: String(paymentChannelReferenceId),
      status: SubscriptionStatus.ACTIVE,
      remarks: '',
    };
  }
}
