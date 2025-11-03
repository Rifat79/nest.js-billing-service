import { Injectable } from '@nestjs/common';
import { Prisma, billing_events } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseRepository } from './base.repository';
import { PrismaService } from './prisma.service';

export type BillingEvent = Prisma.billing_eventsCreateManyInput;

@Injectable()
export class BillingEventRepository extends BaseRepository<
  billing_events,
  Prisma.billing_eventsDelegate,
  Prisma.billing_eventsCreateInput,
  Prisma.billing_eventsUpdateInput,
  Prisma.billing_eventsWhereInput,
  Prisma.billing_eventsWhereUniqueInput
> {
  protected readonly modelName = 'billing_events';

  constructor(
    prisma: PrismaService,
    @InjectPinoLogger(BillingEventRepository.name)
    logger: PinoLogger,
  ) {
    super(prisma, logger);
  }

  protected getDelegate(
    client: PrismaService | Prisma.TransactionClient,
  ): Prisma.billing_eventsDelegate {
    const prismaClient =
      client instanceof PrismaService ? client.client : client;

    return prismaClient?.billing_events;
  }

  async createBatch(
    data: Prisma.billing_eventsCreateManyInput[],
    skipDuplicates?: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    return super.createMany(data as any, skipDuplicates, tx);
  }
}
