import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PaymentChannelWebhookRepository } from 'src/database/payment-channel-webhook.repository';

export interface SSLWebhook {
  amount: string;
  error: string;
  status: string; // 'VALID' | 'VALIDATED' |
  tran_id: string;
}

@Injectable()
export class SSLWebhookService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly webhookRepo: PaymentChannelWebhookRepository,
  ) {
    this.logger.setContext(SSLWebhookService.name);
  }
  async record(payload: SSLWebhook) {
    try {
      await this.webhookRepo.create({
        payment_channel: 'SSL',
        event_type: 'SUBSCRIPTION_ON_DEMAND',
        http_method: '',
        headers: '',
        payload: { ...payload },
        ip_address: '',
        received_at: new Date(),
        processed_at: new Date(),
        processing_status: 'SUCCEEDED',
        subscriptions: {
          connect: { subscription_id: payload.tran_id },
        },
      });
    } catch (error) {
      this.logger.error({
        msg: 'SSL webhook recording failed',
        subscriptionId: payload.tran_id,
        error: error,
        payload,
      });
    }
  }
}
