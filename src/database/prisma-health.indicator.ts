import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const serviceName = this.configService.get<string>(
      'SERVICE_NAME',
      'unknown-service',
    );

    try {
      const startTime = Date.now();
      await this.prismaService.client.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      // Get connection pool metrics
      const metrics = await this.prismaService.getMetrics();

      return this.getStatus(key, true, {
        service: serviceName,
        responseTime: `${responseTime}ms`,
        poolStatus:
          metrics.metrics?.counters?.['prisma.pool.connections.open'] || 'N/A',
      });
    } catch (error) {
      throw new HealthCheckError(
        'Prisma health check failed',
        this.getStatus(key, false, {
          service: serviceName,
          error: error.message,
        }),
      );
    }
  }

  async checkPoolHealth(key: string): Promise<HealthIndicatorResult> {
    try {
      const metrics = await this.prismaService.getMetrics();
      const poolMetrics = metrics.metrics?.counters || {};

      return this.getStatus(key, true, {
        openConnections: poolMetrics['prisma.pool.connections.open'] || 0,
        idleConnections: poolMetrics['prisma.pool.connections.idle'] || 0,
        busyConnections: poolMetrics['prisma.pool.connections.busy'] || 0,
      });
    } catch (error) {
      throw new HealthCheckError(
        'Pool health check failed',
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }
}
