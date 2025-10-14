import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';

type PrismaQueryEvent = {
  query: string;
  params: string;
  duration: number;
  target: string;
  level: 'query';
};

type PrismaLogEvent = {
  message: string;
  target: string;
  level: 'error' | 'info' | 'warn';
};

type MiddlewareParams = {
  model?: string;
  action: string;
  args: any;
  dataPath?: string[];
  runInTransaction?: boolean;
};

type MiddlewareNext = <T>(params: MiddlewareParams) => Promise<T>;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // explicitly declare Prisma client methods to help ESLint/TS
  $connect!: () => Promise<void>;
  $disconnect!: () => Promise<void>;
  $on!: (event: any, callback: any) => void;
  $use!: (middleware: any) => void;
  $queryRaw!: (query: any) => Promise<any>;
  $transaction!: <T>(
    fn: (prisma: Prisma.TransactionClient) => Promise<T>,
    options?: Parameters<PrismaClient['$transaction']>[1],
  ) => Promise<T>;

  private readonly logger = new Logger(PrismaService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly pinoLogger: PinoLogger,
  ) {
    const logLevels = ['query', 'error', 'info', 'warn'];

    const datasourceUrl = new URL(configService.get<string>('db.url')!);
    datasourceUrl.searchParams.set(
      'connection_limit',
      configService.get<string>('db.connectionLimit', '10'),
    );
    datasourceUrl.searchParams.set(
      'pool_timeout',
      configService.get<string>('db.poolTimeout', '20'),
    );
    datasourceUrl.searchParams.set(
      'connect_timeout',
      configService.get<string>('db.connectTimeout', '10'),
    );

    super({
      datasources: {
        db: {
          url: datasourceUrl.toString(),
        },
      },
      log: logLevels.map((level) => ({
        emit: 'event',
        level,
      })),
      errorFormat: 'minimal',
    });

    this.setupLogging();
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connection established successfully');
      this.setupMiddlewares();
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  private setupLogging() {
    this.$on('query', (e: PrismaQueryEvent) => {
      this.pinoLogger.debug(
        {
          query: e.query,
          params: e.params,
          duration: e.duration,
          target: e.target,
        },
        'Database query executed',
      );
    });

    this.$on('error', (e: PrismaLogEvent) => {
      this.pinoLogger.error(
        {
          message: e.message,
          target: e.target,
        },
        'Prisma error occurred',
      );
    });

    this.$on('info', (e: PrismaLogEvent) => {
      this.pinoLogger.info(
        {
          message: e.message,
          target: e.target,
        },
        'Prisma info',
      );
    });

    this.$on('warn', (e: PrismaLogEvent) => {
      this.pinoLogger.warn(
        {
          message: e.message,
          target: e.target,
        },
        'Prisma warning',
      );
    });
  }

  private setupMiddlewares() {
    // Performance logging middleware
    this.$use(
      async <T>(params: MiddlewareParams, next: MiddlewareNext): Promise<T> => {
        const before = Date.now();
        const result = (await next(params)) as T;
        const after = Date.now();
        const duration = after - before;

        if (duration > 1000) {
          this.pinoLogger.warn(
            {
              model: params.model,
              action: params.action,
              duration,
              args: JSON.stringify(params.args),
            },
            'Slow query detected',
          );
        }

        return result;
      },
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  async cleanConnection(): Promise<void> {
    await this.$disconnect();
    await this.$connect();
    this.logger.log('Connection pool cleaned');
  }
}
