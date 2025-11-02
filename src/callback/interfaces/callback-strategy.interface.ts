import { SubscriptionData } from 'src/subscription/subscription.service';

export interface CallbackStrategy {
  withContext(context: {
    subscriptionData: SubscriptionData;
  }): CallbackStrategy;

  handle(query: any): Promise<{ redirectUrl: string }>;
}

export interface CallbackStrategyResult {
  redirectUrl: string;
  paymentStatus: 'PAID' | 'FAILED' | 'CANCELLED' | 'PENDING' | 'UNKNOWN';
  failureReason?: string;
  providerMeta?: any;
  consentId?: any;
  customerReference?: any;
}
