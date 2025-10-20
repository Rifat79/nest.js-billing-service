import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventPublisherService } from './event-publisher.service';

@Module({
  imports: [
    // RabbitMQ Client for publishing events
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.getOrThrow<string>('rmq.url')],
            queue: configService.getOrThrow<string>('rmq.queue'),
            queueOptions: {
              durable: true,
              arguments: {
                'x-message-ttl': 86400000, // 24 hours
                'x-dead-letter-exchange': 'dlx.subscription.notifications',
              },
            },
            prefetchCount: 10,
            persistent: true,
            noAck: true,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [EventPublisherService],
  exports: [EventPublisherService],
})
export class EventPublisherModule {}
