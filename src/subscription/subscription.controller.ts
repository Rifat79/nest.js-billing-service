import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ValidatedPayload } from 'src/common/decorators/validated-payload.decorator';
import { BillingMessagePatterns } from 'src/common/enums/message-patterns';
import { AllExceptionsFilter } from 'src/common/filters/rpc-exception.filter';
import { AocRedirectionDto } from './dto/aoc-redirection.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionsService } from './subscription.service';

@UseFilters(AllExceptionsFilter)
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @MessagePattern(BillingMessagePatterns.CREATE_SUBSCRIPTION)
  async createSubscription(@ValidatedPayload() data: CreateSubscriptionDto) {
    return this.subscriptionsService.createSubscription(data);
  }

  @MessagePattern(BillingMessagePatterns.REDIRECTION)
  async handleAocRedirection(data: AocRedirectionDto) {}

  // @MessagePattern({ cmd: BillingMessagePatterns.CANCEL_SUBSCRIPTION })
  // async cancelSubscription(@Payload() data: any) {
  //   return this.subscriptionsService.cancelSubscription(data);
  // }
}
