import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SubscriptionStatus } from 'src/common/enums/subscription.enums';
import {
  RobiChargeConfig,
  RobiPaymentService,
} from 'src/payment/robi.payment.service';
import { SubscriptionData } from 'src/subscription/subscription.service';
import { CallbackStrategy } from '../interfaces/callback-strategy.interface';
import { CallbackResult } from '../interfaces/callback.interface';

interface RobiCallbackQuery {
  aocTransID: string;
}

@Injectable()
export class RobiCallbackStrategy implements CallbackStrategy {
  private subscriptionData: SubscriptionData;

  constructor(
    private readonly logger: PinoLogger,
    private readonly robiPaymentService: RobiPaymentService,
  ) {
    this.logger.setContext(RobiCallbackStrategy.name);
  }

  withContext({
    subscriptionData,
  }: {
    subscriptionData: SubscriptionData;
  }): this {
    this.subscriptionData = subscriptionData;
    return this;
  }

  async handle(query: RobiCallbackQuery): Promise<CallbackResult> {
    const { urls, subscription_id, chargeConfig } = this.subscriptionData;
    const { aocTransID } = query;
    const traceId = `robi-callback-${subscription_id}`;

    this.logger.info({
      msg: 'Received Robi callback',
      subscriptionId: subscription_id,
      aocTransID,
      traceId,
    });

    const status = await this.robiPaymentService.getAocChargingStatus(
      aocTransID,
      chargeConfig as RobiChargeConfig,
    );

    const normalizedStatus = status?.toUpperCase();

    if (normalizedStatus !== 'CHARGED') {
      this.logger.warn({
        msg: 'Robi charging status not successful',
        subscriptionId: subscription_id,
        aocTransID,
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
      msg: 'Robi charging confirmed',
      subscriptionId: subscription_id,
      aocTransID,
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
