import { SubscriptionStatus } from 'src/common/enums/subscription.enums';

export interface CallbackResult {
  redirectUrl: string;
  status: SubscriptionStatus;
  remarks?: string;
}
