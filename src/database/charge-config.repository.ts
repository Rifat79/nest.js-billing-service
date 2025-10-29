import { Injectable } from '@nestjs/common';
import { Prisma, charging_configurations } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseRepository } from './base.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class ChargeConfigRepository extends BaseRepository<
  charging_configurations,
  Prisma.charging_configurationsDelegate,
  Prisma.charging_configurationsCreateInput,
  Prisma.charging_configurationsUpdateInput,
  Prisma.charging_configurationsWhereInput,
  Prisma.charging_configurationsWhereUniqueInput
> {
  protected readonly modelName = 'charging_configurations';

  constructor(
    prisma: PrismaService,
    @InjectPinoLogger(ChargeConfigRepository.name)
    logger: PinoLogger,
  ) {
    super(prisma, logger);
  }

  protected getDelegate(
    client: PrismaService | Prisma.TransactionClient,
  ): Prisma.charging_configurationsDelegate {
    const prismaClient =
      client instanceof PrismaService ? client.client : client;

    return prismaClient.charging_configurations;
  }
}
