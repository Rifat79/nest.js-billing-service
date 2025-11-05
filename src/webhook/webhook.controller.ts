import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ValidatedPayload } from 'src/common/decorators/validated-payload.decorator';
import { BillingMessagePatterns } from 'src/common/enums/message-patterns';
import { TcpExceptionFilter } from 'src/common/filters/tcp-exception.filter';
import { BLWebhookBody } from './banglalink.webhook.service';
import { WebhookReceiverDto } from './dto/webhook-receiver.dto';
import { WebhookService } from './webhook.service';

@UseFilters(TcpExceptionFilter)
@Controller()
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @MessagePattern(BillingMessagePatterns.WEBHOOK_RECEIVER)
  async receive(@ValidatedPayload() data: WebhookReceiverDto) {
    const provider = data.meta.provider;
    const payload = data?.body ?? data?.params ?? {};
    await this.webhookService.receive(provider, payload as BLWebhookBody);

    return { status: 'accepted' };
  }
}
