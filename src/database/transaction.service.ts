import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from './prisma.service';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {}

  async executeInTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    const transactionId = this.generateTransactionId();

    try {
      this.logger.info({ transactionId }, 'Transaction started');

      const result = await this.prisma.$transaction(callback, {
        maxWait: options?.maxWait || 5000,
        timeout: options?.timeout || 10000,
        isolationLevel:
          options?.isolationLevel ||
          Prisma.TransactionIsolationLevel.ReadCommitted,
      });

      this.logger.info({ transactionId }, 'Transaction committed successfully');
      return result;
    } catch (error) {
      this.logger.error(
        { transactionId, error },
        'Transaction rolled back due to error',
      );
      throw error;
    }
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (this.isRetryableError(error) && attempt < maxRetries) {
          this.logger.warn(
            { attempt, maxRetries, error: error.message },
            'Retrying operation after error',
          );
          await this.delay(delayMs * attempt);
        } else {
          throw error;
        }
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'P2034', // Transaction conflict
      'P2024', // Connection pool timeout
      'P1001', // Can't reach database
      'P1002', // Database timeout
    ];

    return retryableErrors.some((code) => error?.code === code);
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
