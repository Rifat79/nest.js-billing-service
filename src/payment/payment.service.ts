import { Injectable } from '@nestjs/common';
import { payment_channels } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from 'src/common/redis/redis.service';
import { ChargeConfigRepository } from 'src/database/charge-config.repository';
import { PaymentChannelRepository } from 'src/database/payment-channel.repository';
import {
  BanglalinkChargeConfig,
  BanglalinkPaymentService,
} from './banglalink.payment.service';
import {
  BkashChargeConfig,
  BkashPaymentService,
} from './bkash.payment.service';
import { GpPaymentService } from './gp.payment.service';
import { NagadPaymentService } from './nagad.payment.service';
import { RobiChargeConfig, RobiPaymentService } from './robi.payment.service';
import { SSLPaymentService } from './ssl.payment.service';

interface ChargingUrlParams {
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
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly redis: RedisService,
    private readonly gpPaymentService: GpPaymentService,
    private readonly blPaymentService: BanglalinkPaymentService,
    private readonly paymentChannelRepo: PaymentChannelRepository,
    private readonly chargeConfigRepo: ChargeConfigRepository,
    private readonly robiPaymentService: RobiPaymentService,
    private readonly bkashPaymentService: BkashPaymentService,
    private readonly sslPaymentService: SSLPaymentService,
    private readonly nagadPaymentService: NagadPaymentService,
  ) {
    this.logger.setContext(PaymentService.name);
  }

  async getPaymentChannel(code: string): Promise<payment_channels | null> {
    const redisKey = `payment_channels:${code}`;

    try {
      const cached = await this.redis.get<string>(redisKey);
      if (cached) {
        this.logger.debug(`Cache hit for payment channel: ${code}`);
        return JSON.parse(cached) as payment_channels;
      }

      const channel = await this.paymentChannelRepo.findByChannelCode(code);
      if (!channel) {
        this.logger.warn(`Payment channel not found for code: ${code}`);
        return null;
      }

      await this.redis.set(redisKey, JSON.stringify(channel));
      return channel;
    } catch (error) {
      this.logger.error({ code, error }, 'Error retrieving payment channel');
      throw error;
    }
  }

  private async getChargeConfig(
    paymentChannelId: number,
    productId: number,
    planId: number,
  ): Promise<any> {
    const cacheKey = `charge_config:${paymentChannelId}:${productId}:${planId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      this.logger.debug({ cacheKey }, 'Charge config cache hit');
      return cached;
    }

    const config = await this.chargeConfigRepo.findUnique({
      payment_channel_id_product_id_plan_id: {
        payment_channel_id: paymentChannelId,
        product_id: productId,
        plan_id: planId,
      },
    });

    if (config) {
      await this.redis.set(cacheKey, config);
      this.logger.debug({ cacheKey }, 'Charge config cached');
    }

    return config;
  }

  async getChargingUrl(params: ChargingUrlParams): Promise<{ url: string }> {
    const {
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
    } = params;

    const chargeConfig = await this.getChargeConfig(
      paymentChannelId,
      productId,
      planId,
    );

    if (!chargeConfig) {
      this.logger.warn(
        { paymentChannelId, productId, planId },
        'Charge config not found',
      );
      throw new Error(
        `Charge config not found for channel=${paymentChannelId}, product=${productId}, plan=${planId}`,
      );
    }

    try {
      switch (paymentProvider.toUpperCase()) {
        case 'GP': {
          const url = await this.gpPaymentService.prepareConsent({
            msisdn,
            amount,
            currency,
            subscriptionId,
            productDescription,
            merchant: productName,
            initialPaymentAmount,
            durationCountDays,
          });

          if (!url) {
            this.logger.warn(
              { provider: paymentProvider, msisdn, subscriptionId },
              'No URL returned from GP payment service',
            );
            throw new Error('No URL returned from GP payment service');
          }

          return { url };
        }

        case 'BL': {
          const blChargeConfig =
            chargeConfig.config as unknown as BanglalinkChargeConfig;

          const url = await this.blPaymentService.initActivation({
            msisdn,
            amount,
            requestId: subscriptionId,
            chargeConfig: blChargeConfig,
          });

          if (!url) {
            this.logger.warn(
              { provider: paymentProvider, msisdn, subscriptionId },
              'No URL returned from Banglalink payment service',
            );
            throw new Error('No URL returned from Banglalink payment service');
          }

          return { url };
        }

        case 'ROBI': {
          const robiChargeConfig =
            chargeConfig.config as unknown as RobiChargeConfig;

          const { url, aocTransID } = await this.robiPaymentService.getAocToken(
            {
              amount,
              currency,
              referenceCode: subscriptionId,
              msisdn,
              config: robiChargeConfig,
            },
          );

          if (!url) {
            this.logger.warn(
              { provider: paymentProvider, msisdn, subscriptionId },
              'No URL returned from Robi payment service',
            );
            throw new Error('No URL returned from Robi payment service');
          }

          return { url };
        }

        case 'BKASH': {
          const bkashChargeConfig =
            chargeConfig.config as unknown as BkashChargeConfig;

          const url = await this.bkashPaymentService.createSubscription({
            amount,
            initialPaymentAmount: amount,
            validityInDays: durationCountDays,
            subscriptionRequestId: subscriptionId,
            config: bkashChargeConfig,
          });

          if (!url) {
            this.logger.warn(
              { provider: paymentProvider, msisdn, subscriptionId },
              'No URL returned from Bkash payment service',
            );
            throw new Error('No URL returned from Bkash payment service');
          }

          return { url };
        }

        case 'SSL': {
          const { url, sessionKey } = await this.sslPaymentService.initPayment({
            msisdn,
            amount,
            subscriptionId,
          });

          if (!url) {
            this.logger.warn(
              { provider: paymentProvider, msisdn, subscriptionId },
              'No URL returned from SSL payment service',
            );
            throw new Error('No URL returned from SSL payment service');
          }

          return { url };
        }

        case 'NAGAD': {
          const url = await this.nagadPaymentService.createPayment({
            msisdn,
            amount,
            subscriptionId,
          });

          if (!url) {
            this.logger.warn(
              { provider: paymentProvider, msisdn, subscriptionId },
              'No URL returned from Nagad payment service',
            );
            throw new Error('No URL returned from Nagad payment service');
          }

          return { url };
        }

        default:
          this.logger.warn(
            { provider: paymentProvider },
            'Unsupported payment provider',
          );
          throw new Error(`Unsupported payment provider: ${paymentProvider}`);
      }
    } catch (error) {
      this.logger.error(
        {
          provider: paymentProvider,
          msisdn,
          subscriptionId,
          error,
        },
        'Failed to get charging URL',
      );
      throw error;
    }
  }
}
