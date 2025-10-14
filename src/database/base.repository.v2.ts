import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from './prisma.service';

export abstract class BaseRepository<
  T,
  CreateInput extends Prisma.Args<any, 'create'>['data'],
  UpdateInput extends Prisma.Args<any, 'update'>['data'],
  WhereInput extends Record<string, any>,
  WhereUniqueInput extends Record<string, any>,
> {
  protected abstract readonly modelName: string;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly logger: PinoLogger,
    protected readonly eventEmitter?: EventEmitter2,
  ) {}

  protected abstract getDelegate(client?: any): any;

  async create(
    data: CreateInput,
    tx?: any,
    options?: { skipEvent?: boolean },
  ): Promise<T> {
    const client = tx || this.prisma.client;
    try {
      const result = await this.getDelegate(client).create({ data });

      this.logger.info(
        { model: this.modelName, action: 'create', id: (result as any).id },
        'Record created',
      );

      if (this.eventEmitter && !options?.skipEvent) {
        await this.eventEmitter.emitAsync(
          `${this.modelName.toLowerCase()}.created`,
          {
            data: result,
            metadata: {
              timestamp: new Date(),
              action: 'create',
              model: this.modelName,
            },
          },
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        { model: this.modelName, error },
        'Create operation failed',
      );
      throw error;
    }
  }

  async findUnique(
    where: WhereUniqueInput,
    options?: { include?: any; select?: any },
    tx?: any,
  ): Promise<T | null> {
    const client = tx || this.prisma.client;
    try {
      return await this.getDelegate(client).findUnique({ where, ...options });
    } catch (error) {
      this.logger.error(
        { model: this.modelName, error },
        'FindUnique operation failed',
      );
      throw error;
    }
  }

  async findFirst(
    where: WhereInput,
    options?: any,
    tx?: any,
  ): Promise<T | null> {
    const client = tx || this.prisma.client;
    try {
      return await this.getDelegate(client).findFirst({ where, ...options });
    } catch (error) {
      this.logger.error(
        { model: this.modelName, error },
        'FindFirst operation failed',
      );
      throw error;
    }
  }

  async findMany(where?: WhereInput, options?: any, tx?: any): Promise<T[]> {
    const client = tx || this.prisma.client;
    try {
      return await this.getDelegate(client).findMany({ where, ...options });
    } catch (error) {
      this.logger.error(
        { model: this.modelName, error },
        'FindMany operation failed',
      );
      throw error;
    }
  }

  async update(
    where: WhereUniqueInput,
    data: UpdateInput,
    tx?: any,
    options?: { skipEvent?: boolean },
  ): Promise<T> {
    const client = tx || this.prisma.client;
    try {
      const result = await this.getDelegate(client).update({ where, data });

      this.logger.info(
        { model: this.modelName, action: 'update', id: (result as any).id },
        'Record updated',
      );

      if (this.eventEmitter && !options?.skipEvent) {
        await this.eventEmitter.emitAsync(
          `${this.modelName.toLowerCase()}.updated`,
          {
            data: result,
            metadata: {
              timestamp: new Date(),
              action: 'update',
              model: this.modelName,
            },
          },
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        { model: this.modelName, error },
        'Update operation failed',
      );
      throw error;
    }
  }

  async delete(
    where: WhereUniqueInput,
    tx?: any,
    options?: { skipEvent?: boolean; hardDelete?: boolean },
  ): Promise<T> {
    const client = tx || this.prisma.client;
    try {
      let result: T;

      if (options?.hardDelete) {
        result = await this.prisma
          .getRawClient()
          [this.modelName.toLowerCase()].delete({ where });
      } else {
        result = await this.getDelegate(client).delete({ where });
      }

      this.logger.info(
        {
          model: this.modelName,
          action: 'delete',
          id: (result as any).id,
          hardDelete: options?.hardDelete,
        },
        'Record deleted',
      );

      if (this.eventEmitter && !options?.skipEvent) {
        await this.eventEmitter.emitAsync(
          `${this.modelName.toLowerCase()}.deleted`,
          {
            data: result,
            metadata: {
              timestamp: new Date(),
              action: 'delete',
              model: this.modelName,
              hardDelete: options?.hardDelete,
            },
          },
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        { model: this.modelName, error },
        'Delete operation failed',
      );
      throw error;
    }
  }

  // Additional methods like upsert, count, groupBy, restore, etc.
}
