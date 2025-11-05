import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SubscriptionsService } from 'src/subscription/subscription.service';

// Common fields shared by all webhook events
interface BkashWebhookBase {
  subscriptionId: number;
  subscriptionRequestId: string;
  subscriptionReference?: string;
  payer: string;
  frequency: 'DAILY' | 'WEEKLY' | 'FIFTEEN_DAYS' | 'THIRTY_DAYS';
  merchantShortCode: string;
  message?: string | null;
}

// 1️⃣ Payment webhook structure
interface BkashPaymentWebhook extends BkashWebhookBase {
  paymentId: number;
  paymentStatus: 'SUCCEEDED_PAYMENT' | 'FAILED_PAYMENT';
  trxId: string;
  trxDate: string;
  dueDate: string;
  nextPaymentDate: string;
  amount: number;
  firstPayment: boolean;
  errorCode?: string | null;
  subscriptionStatus?: undefined; // prevents overlap
}

// 2️⃣ Subscription webhook structure
interface BkashSubscriptionWebhook extends BkashWebhookBase {
  subscriptionStatus: 'SUCCEEDED' | 'CANCELLED' | 'FAILED';
  cancelledBy?: string | null;
  requesterId?: number | null;
  nextPaymentDate?: string;
  amount?: number;
  paymentStatus?: undefined; // prevents overlap
}

// 3️⃣ Union type (the top-level type)
export type BkashWebhook = BkashPaymentWebhook | BkashSubscriptionWebhook;

@Injectable()
export class BkashWebhookService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly subscriptionService: SubscriptionsService,
  ) {
    this.logger.setContext(BkashWebhookService.name);
  }

  async handleSubscriptionEvent(data: BkashSubscriptionWebhook) {
    const { subscriptionRequestId } = data;
    const subscription = await this.subscriptionService.getSubscriptionDetails(
      subscriptionRequestId,
    );
  }

  async handlePaymentEvent(data: BkashPaymentWebhook) {}
}
