import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly logger: PinoLogger) {}

  async createSubscription(data: CreateSubscriptionDto) {}
  async cancelSubscription() {}
}
