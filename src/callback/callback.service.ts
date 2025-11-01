import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SubscriptionNotFoundException } from 'src/common/exceptions';
import { SubscriptionsService } from 'src/subscription/subscription.service';

@Injectable()
export class CallbackService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly subscriptionService: SubscriptionsService,
  ) {
    this.logger.setContext(CallbackService.name);
  }

  async resolveUrl(subscriptionId: string): Promise<string> {
    try {
      const subscriptionData =
        await this.subscriptionService.getCachedSubscription(subscriptionId);

      if (!subscriptionData) {
        throw new SubscriptionNotFoundException(subscriptionId);
      }

      return subscriptionData?.urls.success;
    } catch (error) {
      throw error;
    }
  }
}
