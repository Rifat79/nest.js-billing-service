import { Injectable } from '@nestjs/common';
import { payment_channels } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from 'src/common/redis/redis.service';
import { PaymentChannelRepository } from 'src/database/payment-channel.repository';
import { GpPaymentService } from './gp.payment.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
    private readonly gpPaymentService: GpPaymentService,
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
        return null;
      }

      await this.redis.set(redisKey, JSON.stringify(paymentChannel));
      return paymentChannel;
    } catch (error) {
      this.logger.error(
        error,
        `Error retrieving payment channel for code ${code}`,
      );
      throw error;
    }
  }

  async getChargingUrl({
    msisdn,
    amount,
    currency,
    paymentProvider,
    subscriptionId,
    productName,
    initialPaymentAmount,
    durationCountDays,
    productDescription,
  }: {
    msisdn: string;
    amount: number;
    currency: string;
    productName: string;
    paymentProvider: string;
    subscriptionId: string;
    productDescription: string;
    initialPaymentAmount: number;
    durationCountDays: number;
  }): Promise<{ url: string }> {
    try {
      switch (paymentProvider) {
        case 'GP': {
          const gpChargeUrl = await this.gpPaymentService.prepareConsent({
            msisdn,
            amount,
            currency,
            subscriptionId,
            productDescription,
            merchant: productName,
            initialPaymentAmount,
            durationCountDays,
          });

          if (gpChargeUrl) {
            return { url: gpChargeUrl };
          } else {
            throw new Error('No URL returned from GP payment service');
          }
        }

        default:
          this.logger.warn(`Unsupported payment provider: ${paymentProvider}`);
          throw new Error(`Unsupported payment provider: ${paymentProvider}`);
      }
    } catch (error) {
      this.logger.error(error, `Failed to get charging url`);
      throw error;
    }
  }
}
