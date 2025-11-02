import { Injectable } from '@nestjs/common';
import { SubscriptionData } from 'src/subscription/subscription.service';
import { CallbackStrategy } from '../interfaces/callback-strategy.interface';

@Injectable()
export class NagadCallbackStrategy implements CallbackStrategy {
  private subscriptionData: SubscriptionData;

  withContext({
    subscriptionData,
  }: {
    subscriptionData: SubscriptionData;
  }): this {
    this.subscriptionData = subscriptionData;
    return this;
  }

  async handle(query: any): Promise<{ redirectUrl: string }> {}
}
