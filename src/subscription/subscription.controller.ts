import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ValidatedPayload } from 'src/common/decorators/validated-payload.decorator';
import { BillingMessagePatterns } from 'src/common/enums/message-patterns';
import { TcpExceptionFilter } from 'src/common/filters/tcp-exception.filter';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { VerifyPinDto, VerifyPinProvider } from './dto/verify-pin.dto';
import { SubscriptionsService } from './subscription.service';

@UseFilters(TcpExceptionFilter)
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @MessagePattern(BillingMessagePatterns.CREATE_SUBSCRIPTION)
  async createSubscription(@ValidatedPayload() data: CreateSubscriptionDto) {
    return this.subscriptionsService.createSubscription(data);
  }

  @MessagePattern(BillingMessagePatterns.CANCEL_SUBSCRIPTION)
  async cancelSubscription(@ValidatedPayload() data: CancelSubscriptionDto) {
    const { body, params } = data;
    const payload = {
      subscriptionId:
        params.path?.length > 0 ? params.path[params.path?.length - 1] : '',
      msisdn: body ? body.msisdn : '',
      transactionId: body ? body.transactionId : '',
    };

    return this.subscriptionsService.cancelSubscription(payload);
  }

  @MessagePattern(BillingMessagePatterns.VERIFY_PIN)
  async verifyPin(@ValidatedPayload() data: VerifyPinDto) {
    const provider =
      data?.meta?.provider ?? data?.body?.provider ?? VerifyPinProvider.BL;
    const subscriptionId =
      data?.query?.order_tracking_id ?? data?.params.subscriptionId;
    const pinCode = data?.query?.consent_no ?? data?.body?.pinCode ?? '#';

    const result = await this.subscriptionsService.verifyPin(provider, {
      subscriptionId,
      pinCode,
      subscriptionContractId: data?.body?.subscriptionContractId,
      operatorCode: data?.body?.operatorCode,
      tpayTransactionId: data?.body?.tpayTransactionId,
      charge: data?.body?.charge,
    });

    return {
      message: result
        ? 'PIN verification successful'
        : 'PIN verification failed',
    };
  }

  // @MessagePattern({ cmd: BillingMessagePatterns.CANCEL_SUBSCRIPTION })
  // async cancelSubscription(@Payload() data: any) {
  //   return this.subscriptionsService.cancelSubscription(data);
  // }
}
