import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { WEBHOOK_RECEIVER_QUEUE } from 'src/common/redis/redis.constants';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
  ) {}

  async receive(provider: string, payload: Record<string, any>) {
    await this.redis.rpush(
      `${WEBHOOK_RECEIVER_QUEUE}:${provider}`,
      JSON.stringify(payload),
    );
  }
}
