import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SubscriptionStatus } from 'src/common/enums/subscription.enums';
import { NagadPaymentService } from 'src/payment/nagad.payment.service';
import { SubscriptionData } from 'src/subscription/subscription.service';
import { CallbackStrategy } from '../interfaces/callback-strategy.interface';
import { CallbackResult } from '../interfaces/callback.interface';

interface NagadCallbackQuery {
  orderId?: string;
  merchant: string;
  order_id?: string;
  payment_ref_id: string;
  status: string;
  status_code: string;
  message: string;
  customer_id: string;
  account_no: string;
  token_type: string;
  token: string;
  token_expiry_dt: string;
}

@Injectable()
export class NagadCallbackStrategy implements CallbackStrategy {
  private subscriptionData: SubscriptionData;

  constructor(
    private readonly logger: PinoLogger,
    private readonly nagadPaymentService: NagadPaymentService,
  ) {
    this.logger.setContext(NagadCallbackStrategy.name);
  }

  withContext({
    subscriptionData,
  }: {
    subscriptionData: SubscriptionData;
  }): this {
    this.subscriptionData = subscriptionData;
    return this;
  }

  async handle(query: NagadCallbackQuery): Promise<CallbackResult> {
    const { payment_ref_id } = query;
    const { urls } = this.subscriptionData;

    const paymentStatus =
      await this.nagadPaymentService.verifyPayment(payment_ref_id);

    if (paymentStatus !== 'Success') {
      return {
        redirectUrl: urls.error,
        status: SubscriptionStatus.ACTIVATION_FAILED,
        remarks: paymentStatus ?? 'MISSING_STATUS',
      };
    }

    return {
      redirectUrl: urls.success,
      status: SubscriptionStatus.ACTIVE,
      remarks: '',
    };
  }
}
