import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { PaymentService } from 'src/payment/payment.service';
import { PlanService } from 'src/plan/plan.service';
import { ProductService } from 'src/product/product.service';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';

@Injectable()
export class EnrichSubscriptionPayloadPipe implements PipeTransform {
  constructor(
    private readonly planPricingService: PlanService,
    private readonly paymentService: PaymentService,
    private readonly productService: ProductService,
  ) {}

  async transform(
    payload: CreateSubscriptionDto,
  ): Promise<CreateSubscriptionDto> {
    const body = payload.body;

    if (!body) {
      throw new BadRequestException('Missing subscription body');
    }

    const { msisdn, keyword, paymentProvider } = body;

    // Detect carrier/region
    // const { carrier, region } = await this.carrierService.resolve(msisdn);

    // Attach carrier info
    // body.carrier = carrier;
    // body.region = region;

    // Lookup product details (optional)
    const product = await this.productService.findByKeyword(keyword);
    if (product) {
      body.productId = product.id;
      body.productType = product.type;
    }

    // Resolve pricing
    const planPricing = await this.planPricingService.resolvePlanPricing({
      keyword,
      paymentProvider,
      carrier,
      region,
    });

    if (!planPricing) {
      throw new BadRequestException(
        'No pricing plan found for this combination',
      );
    }

    // Attach planPricingId
    body.planPricingId = planPricing.id;

    // Return enriched payload
    return {
      ...payload,
      body, // mutated with extra fields
    };
  }
}
