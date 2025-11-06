import { Injectable } from '@nestjs/common';
import { Prisma, payment_channel_webhooks } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseRepository } from './base.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PaymentChannelWebhookRepository extends BaseRepository<
  payment_channel_webhooks,
  Prisma.payment_channel_webhooksDelegate,
  Prisma.payment_channel_webhooksCreateInput,
  Prisma.payment_channel_webhooksUpdateInput,
  Prisma.payment_channel_webhooksWhereInput,
  Prisma.payment_channel_webhooksWhereUniqueInput
> {
  protected readonly modelName = 'payment_channel_webhooks';

  constructor(
    prisma: PrismaService,
    @InjectPinoLogger(PaymentChannelWebhookRepository.name)
    logger: PinoLogger,
  ) {
    super(prisma, logger);
  }

  protected getDelegate(
    client: PrismaService | Prisma.TransactionClient,
  ): Prisma.payment_channel_webhooksDelegate {
    const prismaClient =
      client instanceof PrismaService ? client.client : client;

    return prismaClient?.payment_channel_webhooks;
  }
}
