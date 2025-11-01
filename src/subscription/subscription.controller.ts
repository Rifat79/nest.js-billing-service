import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ValidatedPayload } from 'src/common/decorators/validated-payload.decorator';
import { BillingMessagePatterns } from 'src/common/enums/message-patterns';
import { TcpExceptionFilter } from 'src/common/filters/tcp-exception.filter';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionsService } from './subscription.service';

@UseFilters(TcpExceptionFilter)
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @MessagePattern(BillingMessagePatterns.CREATE_SUBSCRIPTION)
  async createSubscription(@ValidatedPayload() data: CreateSubscriptionDto) {
    return this.subscriptionsService.createSubscription(data);
  }

  // @MessagePattern({ cmd: BillingMessagePatterns.CANCEL_SUBSCRIPTION })
  // async cancelSubscription(@Payload() data: any) {
  //   return this.subscriptionsService.cancelSubscription(data);
  // }
}
