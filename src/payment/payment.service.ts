import { Injectable } from '@nestjs/common';
import { payment_channels } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from 'src/common/redis/redis.service';
import { ChargeConfigRepository } from 'src/database/charge-config.repository';
import { PaymentChannelRepository } from 'src/database/payment-channel.repository';
import { BanglalinkPaymentService } from './banglalink.payment.service';
import { GpPaymentService } from './gp.payment.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
    private readonly gpPaymentService: GpPaymentService,
    private readonly blPaymentService: BanglalinkPaymentService,
    private readonly paymentChannelRepo: PaymentChannelRepository,
    private readonly chargeConfigRepo: ChargeConfigRepository,
  ) {
    this.logger.setContext(PaymentService.name);
  }

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
    paymentChannelId,
    productId,
    planId,
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
    paymentChannelId: number;
    productId: number;
    planId: number;
  }): Promise<{ url: string }> {
    const chargeConfig = await this.chargeConfigRepo.findUnique({
      payment_channel_id_product_id_plan_id: {
        payment_channel_id: paymentChannelId,
        plan_id: planId,
        product_id: productId,
      },
    });

    if (!chargeConfig) {
      throw new Error(
        `Charge config not found for channel=${paymentChannelId}, product=${productId}, plan=${planId}`,
      );
    }

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

          break;
        }

        case 'BL': {
          const blChargeUrl = await this.blPaymentService.initActivation({
            msisdn,
            amount,
            requestId: subscriptionId,
            chargeConfig: chargeConfig,
          });

          if (blChargeUrl) {
            return { url: blChargeUrl };
          } else {
            this.logger.warn(
              {
                provider: paymentProvider,
                payload: {
                  msisdn,
                  amount,
                  subscriptionId,
                },
              },
              'No URL returned from payment service',
            );
          }

          break;
        }

        default:
          this.logger.warn(`Unsupported payment provider: ${paymentProvider}`);
          throw new Error(`Unsupported payment provider: ${paymentProvider}`);
      }
    } catch (error) {
      this.logger.error(
        {
          msisdn,
          paymentProvider,
          subscriptionId,
          error,
        },
        'Failed to get charging URL',
      );
      throw error;
    }
  }
}
