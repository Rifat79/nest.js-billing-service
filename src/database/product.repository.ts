import { Injectable } from '@nestjs/common';
import { Prisma, products } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseRepository } from './base.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class ProductRepository extends BaseRepository<
  products,
  Prisma.productsDelegate,
  Prisma.productsCreateInput,
  Prisma.productsUpdateInput,
  Prisma.productsWhereInput,
  Prisma.productsWhereUniqueInput
> {
  protected readonly modelName = 'Product';

  constructor(
    prisma: PrismaService,
    @InjectPinoLogger(ProductRepository.name)
    logger: PinoLogger,
  ) {
    super(prisma, logger);
  }

  /**
   * Returns the delegate for Prisma Product model.
   * Supports both normal and transactional Prisma clients.
   */
  protected getDelegate(client?: any) {
    return (client || this.prisma.client).products;
  }

  async findProductWithPlanAndPricing(
    name: string,
    paymentChannelId: number,
    pricingAmount: number,
  ) {
    return this.findFirst({
      where: {
        name,
        plans: {
          some: {
            plan_pricing: {
              some: {
                carrier_id: paymentChannelId,
                price: pricingAmount,
              },
            },
          },
        },
      },
      include: {
        plans: {
          include: {
            plan_pricing: {
              where: {
                carrier_id: paymentChannelId,
                price: pricingAmount,
              },
            },
          },
        },
      },
    });
  }
}
