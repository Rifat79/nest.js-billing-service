import { Injectable } from '@nestjs/common';
import { Prisma, product_plans } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseRepository } from './base.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PlanRepository extends BaseRepository<
  product_plans,
  Prisma.product_plansDelegate,
  Prisma.product_plansCreateInput,
  Prisma.product_plansUpdateInput,
  Prisma.product_plansWhereInput,
  Prisma.product_plansWhereUniqueInput
> {
  protected readonly modelName = 'ProductPlan';

  constructor(
    prisma: PrismaService,
    @InjectPinoLogger(PlanRepository.name)
    logger: PinoLogger,
  ) {
    super(prisma, logger);
  }

  /**
   * Returns the delegate for Prisma ProductPlan model.
   * Supports both normal and transactional Prisma clients.
   */
  protected getDelegate(client?: any) {
    return (client || this.prisma.client).product_plans;
  }
}
