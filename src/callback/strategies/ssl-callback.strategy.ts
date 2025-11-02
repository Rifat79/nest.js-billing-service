import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SubscriptionStatus } from 'src/common/enums/subscription.enums';
import { SSLPaymentService } from 'src/payment/ssl.payment.service';
import { SubscriptionData } from 'src/subscription/subscription.service';
import { CallbackStrategy } from '../interfaces/callback-strategy.interface';
import { CallbackResult } from '../interfaces/callback.interface';

interface SslCallbackQuery {
  tran_id?: string;
  status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
}

@Injectable()
export class SSLCallbackStrategy implements CallbackStrategy {
  private subscriptionData: SubscriptionData;

  constructor(
    private readonly logger: PinoLogger,
    private readonly sslPaymentService: SSLPaymentService,
  ) {
    this.logger.setContext(SSLCallbackStrategy.name);
  }

  withContext({
    subscriptionData,
  }: {
    subscriptionData: SubscriptionData;
  }): this {
    this.subscriptionData = subscriptionData;
    return this;
  }

  async handle(query: SslCallbackQuery): Promise<CallbackResult> {
    const { urls, subscription_id } = this.subscriptionData;
    const { tran_id, status } = query;
    const traceId = `ssl-callback-${subscription_id}`;

    this.logger.info({
      msg: 'Received SSL callback',
      subscriptionId: subscription_id,
      transactionId: tran_id,
      traceId,
    });

    if (status === 'CANCELLED') {
      return {
        redirectUrl: urls.deny,
        status: SubscriptionStatus.CONSENT_REJECTED,
        remarks: '',
      };
    }

    if (status === 'FAILED') {
      return {
        redirectUrl: urls.error,
        status: SubscriptionStatus.CONSENT_FAILED,
        remarks: '',
      };
    }

    const paymentStatus =
      await this.sslPaymentService.queryPaymentStatusWithTransactionId(
        tran_id ?? '#',
      );
    const normalizedStatus = paymentStatus?.toUpperCase();

    if (
      !normalizedStatus ||
      !['VALID', 'VALIDATED'].includes(normalizedStatus)
    ) {
      this.logger.warn({
        msg: 'SSL payment status not successful',
        subscriptionId: subscription_id,
        transactionId: tran_id,
        status: normalizedStatus ?? 'MISSING',
        traceId,
      });

      return {
        redirectUrl: urls.error,
        status: SubscriptionStatus.ACTIVATION_FAILED,
        remarks: normalizedStatus ?? 'MISSING_STATUS',
      };
    }

    this.logger.info({
      msg: 'SSL payment verified',
      subscriptionId: subscription_id,
      transactionId: tran_id,
      status: normalizedStatus,
      traceId,
    });

    return {
      redirectUrl: urls.success,
      status: SubscriptionStatus.ACTIVE,
      remarks: '',
    };
  }
}
