import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { firstValueFrom, timeout } from 'rxjs';
import { DatabaseEvent } from './database.events';

@Injectable()
export class DatabaseEventPublisher {
  constructor(
    @Inject('NATS_SERVICE') private readonly natsClient: ClientProxy,
    @InjectPinoLogger(DatabaseEventPublisher.name)
    private readonly logger: PinoLogger,
  ) {}

  async publish(event: DatabaseEvent): Promise<void> {
    try {
      const pattern = `${event.aggregateType}.${event.eventType}`;

      this.logger.debug(
        {
          pattern,
          aggregateId: event.aggregateId,
          correlationId: event.metadata.correlationId,
        },
        'Publishing database event',
      );

      await firstValueFrom(
        this.natsClient.emit(pattern, event.toJSON()).pipe(timeout(5000)),
      );

      this.logger.info(
        { pattern, aggregateId: event.aggregateId },
        'Database event published successfully',
      );
    } catch (error) {
      this.logger.error(
        { event: event.toJSON(), error: error.message },
        'Failed to publish database event',
      );
      throw error;
    }
  }

  async publishBatch(events: DatabaseEvent[]): Promise<void> {
    await Promise.all(events.map((event) => this.publish(event)));
  }
}
