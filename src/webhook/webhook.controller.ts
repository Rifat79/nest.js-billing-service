import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ValidatedPayload } from 'src/common/decorators/validated-payload.decorator';
import { BillingMessagePatterns } from 'src/common/enums/message-patterns';
import { WebhookProviderNotFoundException } from 'src/common/exceptions';
import { TcpExceptionFilter } from 'src/common/filters/tcp-exception.filter';
import { BLWebhookBody } from './banglalink.webhook.service';
import { BkashWebhook } from './bkash.webhook.service';
import { WebhookReceiverDto } from './dto/webhook-receiver.dto';
import { SSLWebhook } from './ssl.webhook.service';
import { WebhookService } from './webhook.service';

@UseFilters(TcpExceptionFilter)
@Controller()
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @MessagePattern(BillingMessagePatterns.WEBHOOK_RECEIVER)
  async receive(@ValidatedPayload() data: WebhookReceiverDto) {
    const { provider } = data.meta;

    if (provider === 'BL') {
      await this.webhookService.receive('BL', data.body as BLWebhookBody);
    } else if (provider === 'BKASH') {
      await this.webhookService.receive('BKASH', data.body as BkashWebhook);
    }
    if (provider === 'SSL') {
      await this.webhookService.receive('SSL', data.body as SSLWebhook);
    } else {
      throw new WebhookProviderNotFoundException(provider);
    }

    return { status: 'received' };
  }
}
