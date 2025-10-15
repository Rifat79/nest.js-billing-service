import { Injectable } from '@nestjs/common';
import { Prisma, plan_pricing } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseRepository } from './base.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PlanPricingRepository extends BaseRepository<
  plan_pricing,
  Prisma.plan_pricingDelegate,
  Prisma.plan_pricingCreateInput,
  Prisma.plan_pricingUpdateInput,
  Prisma.plan_pricingWhereInput,
  Prisma.plan_pricingWhereUniqueInput
> {
  protected readonly modelName = 'PlanPricing';

  constructor(
    prisma: PrismaService,
    @InjectPinoLogger(PlanPricingRepository.name)
    logger: PinoLogger,
  ) {
    super(prisma, logger);
  }

  /**
   * Returns the delegate for Prisma PlanPricing model.
   * Supports both normal and transactional Prisma clients.
   */
  protected getDelegate(client?: any) {
    return (client || this.prisma.client).plan_pricing;
  }
}
