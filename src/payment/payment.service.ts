import { Injectable } from '@nestjs/common';
import { payment_channels } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import {
  ChargeConfigNotFoundException,
  NoUrlReturnedException,
  UnsupportedProviderException,
} from 'src/common/exceptions';
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
import { GpChargeConfig, GpPaymentService } from './gp.payment.service';
import { NagadPaymentService } from './nagad.payment.service';
import { RobiChargeConfig, RobiPaymentService } from './robi.payment.service';
import { SSLPaymentService } from './ssl.payment.service';

interface ChargingUrlParams {
  msisdn: string;
  amount: number;
  currency: string;
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

  async getChargingUrl(params: ChargingUrlParams): Promise<{
    url: string;
    aocTransID?: string;
    sessionKey?: string;
    chargeConfig: Record<string, any>;
  }> {
    const {
      msisdn,
      amount,
      currency,
      paymentProvider,
      subscriptionId,
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
      throw new ChargeConfigNotFoundException(
        paymentChannelId,
        productId,
        planId,
      );
    }

    const provider = paymentProvider.toUpperCase();

    const providerHandlers: Record<
      string,
      () => Promise<{ url: string; aocTransID?: string; sessionKey?: string }>
    > = {
      GP: async () => {
        const gpChargeConfig = chargeConfig.config as GpChargeConfig;
        const url = await this.gpPaymentService.prepareConsent({
          msisdn,
          amount,
          currency,
          subscriptionId,
          productDescription,
          initialPaymentAmount,
          durationCountDays,
          config: gpChargeConfig,
        });
        return { url };
      },

      BL: async () => {
        const blChargeConfig = chargeConfig.config as BanglalinkChargeConfig;
        const url = await this.blPaymentService.initActivation({
          msisdn,
          amount,
          requestId: subscriptionId,
          chargeConfig: blChargeConfig,
        });
        return { url };
      },

      ROBI: async () => {
        const robiChargeConfig = chargeConfig.config as RobiChargeConfig;
        const { url, aocTransID } = await this.robiPaymentService.getAocToken({
          amount,
          currency,
          referenceCode: subscriptionId,
          msisdn,
          config: robiChargeConfig,
        });
        return { url, aocTransID };
      },

      BKASH: async () => {
        const bkashChargeConfig = chargeConfig.config as BkashChargeConfig;
        const url = await this.bkashPaymentService.createSubscription({
          amount,
          initialPaymentAmount,
          validityInDays: durationCountDays,
          subscriptionRequestId: subscriptionId,
          config: bkashChargeConfig,
        });
        return { url };
      },

      SSL: async () => {
        const { url, sessionKey } = await this.sslPaymentService.initPayment({
          msisdn,
          amount,
          subscriptionId,
        });
        return { url, sessionKey };
      },

      NAGAD: async () => {
        const url = await this.nagadPaymentService.createPayment({
          msisdn,
          amount,
          subscriptionId,
        });
        return { url };
      },
    };

    try {
      const handler = providerHandlers[provider];

      if (!handler) {
        this.logger.warn({ provider }, 'Unsupported payment provider');
        throw new UnsupportedProviderException(provider);
      }

      const result = await handler();

      if (!result.url) {
        this.logger.warn(
          { provider, msisdn, subscriptionId },
          'No URL returned from payment service',
        );
        throw new NoUrlReturnedException(provider, msisdn, subscriptionId);
      }

      return { ...result, chargeConfig: chargeConfig.config };
    } catch (error) {
      this.logger.error(
        { provider, msisdn, subscriptionId, error },
        'Failed to get charging URL',
      );
      throw error;
    }
  }
}
