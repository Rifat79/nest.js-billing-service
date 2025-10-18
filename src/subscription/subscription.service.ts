import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PaymentService } from 'src/payment/payment.service';
import { ProductService } from 'src/product/product.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly productService: ProductService,
    private readonly paymentService: PaymentService,
  ) {}

  async createSubscription(
    data: CreateSubscriptionDto,
  ): Promise<{ url: string }> {
    try {
      const { msisdn, transactionId, urls, paymentProvider, keyword, amount } =
        data.body;

      const paymentChannel =
        await this.paymentService.getPaymentChannel(paymentProvider);

      if (!paymentChannel) {
        throw new Error('payment channel was not found');
      }

      const product = await this.productService.getProductPlanWithPricing(
        keyword,
        amount,
        paymentChannel.id,
      );

      if (!product) {
        throw new Error('product was not found');
      }

      return { url: '' };
    } catch (e) {
      this.logger.error({});
      throw e;
    }
  }

  // async cancelSubscription() {
  //   return 0;
  // }
}
