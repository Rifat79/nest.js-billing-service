import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PinoLogger } from 'nestjs-pino';
import { lastValueFrom, retry, timeout } from 'rxjs';

@Injectable()
export class EventPublisherService {
  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly rabbitClient: ClientProxy,
    private readonly logger: PinoLogger,
  ) {}

  async publishBillingEvent(event: any): Promise<void> {
    try {
      const enrichedEvent = {
        ...(typeof event === 'object' ? event : {}),
        timestamp: new Date().toISOString(),
        service: 'billing-service',
        version: '1.0.0',
      };

      // Publish to RabbitMQ with retry logic
      await lastValueFrom(
        this.rabbitClient.emit('billing.events', enrichedEvent).pipe(
          timeout(5000), // 5 second timeout
          retry(3), // Retry 3 times
        ),
      );
    } catch (error) {
      this.logger.error(error, 'Failed to publish event');
      throw error;
    }
  }

  async onModuleInit() {
    await this.rabbitClient.connect();
    this.logger.info('Connected to RabbitMQ', 'EventPublisher');
  }

  async onModuleDestroy() {
    await this.rabbitClient.close();
    this.logger.info('Disconnected from RabbitMQ', 'EventPublisher');
  }
}
