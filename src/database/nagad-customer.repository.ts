import { Injectable } from '@nestjs/common';
import { Prisma, nagad_customers } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseRepository } from './base.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class NagadCustomerRepository extends BaseRepository<
  nagad_customers,
  Prisma.nagad_customersDelegate,
  Prisma.nagad_customersCreateInput,
  Prisma.nagad_customersUpdateInput,
  Prisma.nagad_customersWhereInput,
  Prisma.nagad_customersWhereUniqueInput
> {
  protected readonly modelName = 'nagad_customers';

  constructor(
    prisma: PrismaService,
    @InjectPinoLogger(NagadCustomerRepository.name)
    logger: PinoLogger,
  ) {
    super(prisma, logger);
  }

  protected getDelegate(
    client: PrismaService | Prisma.TransactionClient,
  ): Prisma.nagad_customersDelegate {
    const prismaClient =
      client instanceof PrismaService ? client.client : client;

    return prismaClient.nagad_customers;
  }
}
