import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prismaClient: PrismaClient;
  public client: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.initializePrismaClient();
  }

  private initializePrismaClient() {
    const dataSourceUrl = new URL(
      this.configService.getOrThrow<string>('db.url'),
    );
    dataSourceUrl.searchParams.set(
      'connection_limit',
      this.configService.getOrThrow<string>('db.connectionLimit', '10'),
    );
    dataSourceUrl.searchParams.set(
      'pool_timeout',
      this.configService.getOrThrow<string>('db.poolTimeout', '20'),
    );
    dataSourceUrl.searchParams.set(
      'connect_timeout',
      this.configService.get('db.connectTimeout', '10'),
    );

    if (this.configService.get<boolean>('db.usePgBouncer', false)) {
      dataSourceUrl.searchParams.set('pgbouncer', 'true');
    }

    this.prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: dataSourceUrl.toString(),
        },
      },
      log: ['query', 'info', 'warn', 'error'],
      errorFormat: 'minimal',
    });

    this.setUpLogging();
    this.applyExtensions();
  }

  private applyExtensions() {
    const slowQueryThreshold = this.configService.get<number>(
      'SLOW_QUERY_THRESHOLD',
      1000,
    );
    // TODO Update auditModels as needed
    const auditModels = [
      'Transaction',
      'Subscription',
      'Payment',
      'Refund',
      'Charge',
    ];

    this.client = this.prismaClient
      .$extends({
        name: 'performanceLogging',
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }) {
              const before = Date.now();
              const result = await query(args);
              const after = Date.now();
              const duration = after - before;

              if (duration > slowQueryThreshold) {
                this.pinoLogger.warn(
                  {
                    service: this.serviceName,
                    model,
                    operation,
                    duration,
                  },
                  'Slow query detected',
                );
              }

              return result;
            },
          },
        },
      })
      .$extends({
        name: 'auditTrail',
        query: {
          $allModels: {
            async create({ model, operation, args, query }) {
              const result = await query(args);

              if (auditModels.includes(model)) {
                this.pinoLogger.info(
                  {
                    service: this.serviceName,
                    model,
                    operation: 'create',
                    id: (result as any)?.id,
                    timestamp: new Date().toISOString(),
                  },
                  'Audit: Critical operation',
                );
              }

              return result;
            },
            async update({ model, operation, args, query }) {
              const result = await query(args);

              if (auditModels.includes(model)) {
                this.pinoLogger.info(
                  {
                    service: this.serviceName,
                    model,
                    operation: 'update',
                    id: (result as any)?.id,
                    timestamp: new Date().toISOString(),
                  },
                  'Audit: Critical operation',
                );
              }

              return result;
            },
            async delete({ model, operation, args, query }) {
              const result = await query(args);

              if (auditModels.includes(model)) {
                this.pinoLogger.info(
                  {
                    service: this.serviceName,
                    model,
                    operation: 'delete',
                    id: (result as any)?.id,
                    timestamp: new Date().toISOString(),
                  },
                  'Audit: Critical operation',
                );
              }

              return result;
            },
            async upsert({ model, operation, args, query }) {
              const result = await query(args);

              if (auditModels.includes(model)) {
                this.pinoLogger.info(
                  {
                    service: this.serviceName,
                    model,
                    operation: 'upsert',
                    id: (result as any)?.id,
                    timestamp: new Date().toISOString(),
                  },
                  'Audit: Critical operation',
                );
              }

              return result;
            },
          },
        },
      })
      .$extends({
        name: 'timestamps',
        query: {
          $allModels: {
            async create({ args, query }) {
              args.data = {
                ...args.data,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              return query(args);
            },
            async update({ args, query }) {
              args.data = {
                ...args.data,
                updatedAt: new Date(),
              };
              return query(args);
            },
            async updateMany({ args, query }) {
              args.data = {
                ...args.data,
                updatedAt: new Date(),
              };
              return query(args);
            },
            async upsert({ args, query }) {
              args.create = {
                ...args.create,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              args.update = {
                ...args.update,
                updatedAt: new Date(),
              };
              return query(args);
            },
          },
        },
      });
  }

  async onModuleInit() {
    try {
      await this.client.$connect();
      this.logger.info('Database connection established successfully');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.$disconnect();
      this.logger.info('Database connection closed successfully');
    } catch (error) {
      this.logger.error('Failed to close database connection', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(`Health check failed`, error);
      return false;
    }
  }

  private setUpLogging() {
    this.$on('query' as never, (e: Prisma.QueryEvent) => {
      this.logger.debug(
        {
          query: e.query,
          params: e.params,
          duration: e.duration,
          target: e.target,
        },
        'Database query executed',
      );
    });

    this.$on('error' as never, (e: Prisma.LogEvent) => {
      this.logger.error(
        { target: e.target, message: e.message, timestamp: e.timestamp },
        'Prisma error occurred',
      );
    });

    this.$on('info' as never, (e: Prisma.LogEvent) => {
      this.logger.info(
        { message: e.message, target: e.target, timestamp: e.timestamp },
        'Prisma info',
      );
    });

    this.$on('warn' as never, (e: Prisma.LogEvent) => {
      this.logger.warn(
        { message: e.message, target: e.target, timestamp: e.timestamp },
        'Prisma warning',
      );
    });
  }

  async cleanConnection(): Promise<void> {
    await this.client.$disconnect();
    await this.client.$connect();
    this.logger.info(`Connection pool cleaned`);
  }

  // Helper to get raw client without extensions (for special cases)
  getRawClient(): PrismaClient {
    return this.prismaClient;
  }
}
