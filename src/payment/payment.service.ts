import { Injectable } from '@nestjs/common';
import { payment_channels } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from 'src/common/redis/redis.service';
import { PaymentChannelRepository } from 'src/database/payment-channel.repository';

@Injectable()
export class PaymentService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
    private readonly paymentChannelRepo: PaymentChannelRepository,
  ) {}

  async getPaymentChannel(code: string): Promise<payment_channels | null> {
    try {
      const redisKey = `payment_channels:${code}`;
      const cache = await this.redis.get<payment_channels>(redisKey);

      if (cache) {
        this.logger.debug(`Cache hit for payment channel: ${code}`);
        return cache;
      }

      const paymentChannel =
        await this.paymentChannelRepo.findByChannelCode(code);
      if (!paymentChannel) {
        this.logger.warn(`Payment channel not found for code: ${code}`);
        return null; // or throw, depending on business logic
      }

      await this.redis.set(redisKey, JSON.stringify(paymentChannel));
      return paymentChannel;
    } catch (error) {
      this.logger.error(`Error retrieving payment channel for code ${code}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
