import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { ProductRepository } from './product.repository';

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
        // PrismaHealthIndicator,
        // TransactionService,
        // PrismaBatchService,
        {
          provide: 'SERVICE_NAME',
          useValue: options?.serviceName || 'default-service',
        },
        ProductRepository,
      ],
      exports: [
        PrismaService,
        // PrismaHealthIndicator,
        // TransactionService,
        // PrismaBatchService,
        ProductRepository,
      ],
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: PrismaModule,
      imports: [ConfigModule],
      providers: [
        PrismaService,
        ProductRepository /*TransactionService, PrismaBatchService*/,
      ],
      exports: [
        PrismaService,
        ProductRepository /*TransactionService, PrismaBatchService*/,
      ],
    };
  }
}
