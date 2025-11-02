import { Injectable } from '@nestjs/common';
import { CallbackStrategyNotFoundException } from 'src/common/exceptions/callback.exceptions';
import { SubscriptionData } from 'src/subscription/subscription.service';
import { CallbackStrategy } from './interfaces/callback-strategy.interface';
import { GpCallbackStrategy } from './strategies';

@Injectable()
export class CallbackStrategyFactory {
  private readonly strategyMap: Record<string, CallbackStrategy>;

  constructor(
    private readonly gpCallbackStrategy: GpCallbackStrategy,
    // private readonly robiCallbackStrategy: RobiCallbackStrategy,
    // private readonly bkashCallbackStrategy: BkashCallbackStrategy,
    // private readonly sslCallbackStrategy: SSLCallbackStrategy,
    // private readonly nagadCallbackStrategy: NagadCallbackStrategy,
  ) {
    this.strategyMap = {
      GP: this.gpCallbackStrategy,
      //   ROBI: this.robiCallbackStrategy,
      //   BKASH: this.bkashCallbackStrategy,
      //   SSL: this.sslCallbackStrategy,
      //   NAGAD: this.nagadCallbackStrategy,
    };
  }

  private getStrategy(provider: string): CallbackStrategy {
    const strategy = this.strategyMap[provider.toUpperCase()];
    if (!strategy) {
      throw new CallbackStrategyNotFoundException(provider);
    }
    return strategy;
  }

  async handleCallback(
    subscriptionData: SubscriptionData,
    query: any,
  ): Promise<string> {
    const strategy = this.getStrategy(subscriptionData.paymentProvider);

    const result = await strategy
      .withContext({ subscriptionData })
      .handle(query);

    return result.redirectUrl;
  }
}
