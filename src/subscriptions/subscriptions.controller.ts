import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BillingMessagePatterns } from 'src/common/enums/message-patterns';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @MessagePattern({ cmd: BillingMessagePatterns.CREATE_SUBSCRIPTION })
  async createSubscription(@Payload() data: CreateSubscriptionDto) {
    return this.subscriptionsService.createSubscription(data);
  }

  @MessagePattern({ cmd: BillingMessagePatterns.CANCEL_SUBSCRIPTION })
  async cancelSubscription(@Payload() data: any) {
    return this.subscriptionsService.cancelSubscription(data);
  }
}
