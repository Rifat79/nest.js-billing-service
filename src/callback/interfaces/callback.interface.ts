import { SubscriptionStatus } from 'src/common/enums/subscription.enums';

export interface CallbackResult {
  redirectUrl: string;
  status?: SubscriptionStatus;
  remarks?: string;
  billingContext?: {
    requestPayload: any;
    response: {
      code?: string;
      message?: string;
      payload?: any;
      duration?: number;
    };
  };
}
