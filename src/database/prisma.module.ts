import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaBatchService } from './prisma-batch.service';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { PrismaService } from './prisma.service';
import { TransactionService } from './transaction.service';

export interface PrismaModuleOptions {
  isGlobal?: boolean;
  serviceName?: string;
}

@Global()
@Module({})
export class PrismaModule {
  static forRoot(options?: PrismaModuleOptions): DynamicModule {
    return {
      module: PrismaModule,
      global: options?.isGlobal ?? true,
      imports: [ConfigModule],
      providers: [
        PrismaService,
        PrismaHealthIndicator,
        TransactionService,
        PrismaBatchService,
        {
          provide: 'SERVICE_NAME',
          useValue: options?.serviceName || 'default-service',
        },
      ],
      exports: [
        PrismaService,
        PrismaHealthIndicator,
        TransactionService,
        PrismaBatchService,
      ],
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: PrismaModule,
      imports: [ConfigModule],
      providers: [PrismaService, TransactionService, PrismaBatchService],
      exports: [PrismaService, TransactionService, PrismaBatchService],
    };
  }
}
