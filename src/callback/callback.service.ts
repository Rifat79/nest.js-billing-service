import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SubscriptionNotFoundException } from 'src/common/exceptions';
import { SubscriptionsService } from 'src/subscription/subscription.service';
import { CallbackStrategyFactory } from './callback-strategy.factory';

@Injectable()
export class CallbackService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly subscriptionService: SubscriptionsService,
    private readonly callbackStrategyFactory: CallbackStrategyFactory,
  ) {
    this.logger.setContext(CallbackService.name);
  }

  async resolveUrl(
    subscriptionId: string,
    query: Record<string, any>,
  ): Promise<string> {
    const subscriptionData =
      await this.subscriptionService.getCachedSubscription(subscriptionId);

    if (!subscriptionData) {
      throw new SubscriptionNotFoundException(subscriptionId);
    }

    const url = await this.callbackStrategyFactory.handleCallback(
      subscriptionData,
      query,
    );

    return url;
  }
}
