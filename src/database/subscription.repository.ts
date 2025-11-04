import { Injectable } from '@nestjs/common';
import {
  charging_configurations,
  payment_channels,
  plan_pricing,
  Prisma,
  product_plans,
  products,
  subscriptions,
} from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseRepository } from './base.repository';
import { PrismaService } from './prisma.service';

export type SubscriptionsCreateInput = Prisma.subscriptionsCreateManyInput;

export type SubscriptionDetails = subscriptions & {
  payment_channels: payment_channels;
  products: products;
  product_plans: product_plans;
  plan_pricing: plan_pricing | null;
  charging_configurations: charging_configurations | null;
};

@Injectable()
export class SubscriptionRepository extends BaseRepository<
  subscriptions,
  Prisma.subscriptionsDelegate,
  Prisma.subscriptionsCreateInput,
  Prisma.subscriptionsUpdateInput,
  Prisma.subscriptionsWhereInput,
  Prisma.subscriptionsWhereUniqueInput
> {
  protected readonly modelName = 'subscriptions';

  constructor(
    prisma: PrismaService,
    @InjectPinoLogger(SubscriptionRepository.name)
    logger: PinoLogger,
  ) {
    super(prisma, logger);
  }

  protected getDelegate(
    client: PrismaService | Prisma.TransactionClient,
  ): Prisma.subscriptionsDelegate {
    const prismaClient =
      client instanceof PrismaService ? client.client : client;

    return prismaClient.subscriptions;
  }

  async findByMsisdn(msisdn: string, paymentChannelId: number, planId: number) {
    return this.findFirst({
      msisdn: msisdn,
      payment_channel_id: paymentChannelId,
      plan_id: planId,
    });
  }

  async createBatch(
    data: Prisma.subscriptionsCreateManyInput[],
    skipDuplicates?: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    return super.createMany(data as any, skipDuplicates, tx);
  }

  async findSubscriptionDetails(subscriptionId: string) {
    return this.getDelegate(this.prisma).findUnique({
      where: { subscription_id: subscriptionId },
      include: {
        payment_channels: true,
        products: true,
        product_plans: true,
        plan_pricing: true,
        charging_configurations: true,
      },
    });
  }
}
