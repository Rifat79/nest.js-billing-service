import { Injectable } from '@nestjs/common';
import { charging_configurations, payment_channels } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PaymentProvider } from 'src/common/enums/payment-providers';
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
  BanglalinkInitDeactivationPayload,
  BanglalinkPaymentService,
} from './banglalink.payment.service';
import {
  BkashChargeConfig,
  BkashPaymentService,
} from './bkash.payment.service';
import { GpChargeConfig, GpPaymentService } from './gp.payment.service';
import { NagadPaymentService } from './nagad.payment.service';
import {
  RobiCancelAocTokenPayload,
  RobiChargeConfig,
  RobiPaymentService,
} from './robi.payment.service';
import { SSLPaymentService } from './ssl.payment.service';

interface ChargingUrlParams {
  msisdn: string;
  amount: number;
  currency: string;
  paymentProvider: PaymentProvider;
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
  ): Promise<charging_configurations | null> {
    const cacheKey = `charge_config:${paymentChannelId}:${productId}:${planId}`;
    const cached = await this.redis.get<charging_configurations>(cacheKey);

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
    chargeConfig: charging_configurations;
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
        const gpChargeConfig = chargeConfig.config as unknown as GpChargeConfig;
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
        const blChargeConfig =
          chargeConfig.config as unknown as BanglalinkChargeConfig;
        const url = await this.blPaymentService.initActivation({
          msisdn,
          amount,
          requestId: subscriptionId,
          chargeConfig: blChargeConfig,
        });
        return { url };
      },

      ROBI: async () => {
        const robiChargeConfig =
          chargeConfig.config as unknown as RobiChargeConfig;
        const { url, aocTransID } = await this.robiPaymentService.getAocToken({
          subscriptionId,
          amount,
          currency,
          referenceCode: subscriptionId,
          msisdn,
          config: robiChargeConfig,
        });
        return { url, aocTransID };
      },

      BKASH: async () => {
        const bkashChargeConfig =
          chargeConfig.config as unknown as BkashChargeConfig;
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

      return { ...result, chargeConfig };
    } catch (error) {
      this.logger.error(
        { provider, msisdn, subscriptionId, error },
        'Failed to get charging URL',
      );
      throw error;
    }
  }

  async gpInvalidateAcr(customerReference: string): Promise<boolean> {
    const traceId = `invalidate-acr-${customerReference}`;

    try {
      const result =
        await this.gpPaymentService.invalidateACR(customerReference);

      if (!result.success) {
        this.logger.warn({
          msg: 'GP ACR invalidation failed',
          customerReference,
          traceId,
          responsePayload: result.responsePayload,
        });
        return false;
      }

      this.logger.info({
        msg: 'GP ACR invalidated successfully',
        customerReference,
        traceId,
        responsePayload: result.responsePayload,
      });

      return true;
    } catch (error) {
      this.logger.error({
        msg: 'Exception during GP ACR invalidation',
        customerReference,
        traceId,
        error,
      });
      return false;
    }
  }

  async blInitDeactivation(
    data: BanglalinkInitDeactivationPayload,
  ): Promise<boolean> {
    const { msisdn, requestId } = data;
    const traceId = `bl-deactivation-${requestId}`;

    try {
      this.logger.info(
        { msisdn, requestId, traceId },
        'Initiating Banglalink deactivation',
      );

      const result = await this.blPaymentService.initDeactivation(data);

      if (!result.success) {
        this.logger.warn(
          {
            msg: 'Banglalink deactivation failed',
            msisdn,
            requestId,
            traceId,
            responsePayload: result.raw,
          },
          'Non-zero response code from Banglalink',
        );
        return false;
      }

      this.logger.info({
        msg: 'Banglalink deactivation successful',
        msisdn,
        requestId,
        traceId,
        responsePayload: result.raw,
      });

      return true;
    } catch (error) {
      this.logger.error({
        msg: 'Exception during Banglalink deactivation',
        msisdn,
        requestId,
        traceId,
        error,
      });
      return false;
    }
  }

  async robiCancelAocToken(data: RobiCancelAocTokenPayload): Promise<boolean> {
    const { subscriptionId, msisdn, config } = data;
    const traceId = `robi-cancel-${subscriptionId}`;

    try {
      this.logger.info(
        { traceId, msisdn, subscriptionId },
        'Initiating Robi AOC cancellation',
      );

      const result = await this.robiPaymentService.cancelAocToken(data);

      if (!result) {
        this.logger.warn(
          {
            msg: 'Robi AOC cancellation failed',
            msisdn,
            subscriptionId,
            traceId,
          },
          'Non-zero error code or failed response from Robi',
        );
        return false;
      }

      this.logger.info({
        msg: 'Robi AOC cancellation successful',
        msisdn,
        subscriptionId,
        traceId,
      });

      return true;
    } catch (error) {
      this.logger.error({
        msg: 'Exception during Robi AOC cancellation',
        msisdn,
        subscriptionId,
        traceId,
        error,
      });
      return false;
    }
  }

  async bkashCancelSubscription(data: {
    paymentChannelReferenceId: string;
    config: BkashChargeConfig;
  }): Promise<boolean> {
    const { paymentChannelReferenceId, config } = data;
    const traceId = `bkash-cancel-${paymentChannelReferenceId}`;

    try {
      this.logger.info(
        { traceId, paymentChannelReferenceId },
        'Initiating bKash subscription cancellation',
      );

      const success = await this.bkashPaymentService.cancelSubscription({
        paymentChannelReferenceId,
        config,
      });

      if (!success) {
        this.logger.warn(
          {
            traceId,
            paymentChannelReferenceId,
          },
          'bKash subscription cancellation failed',
        );
        return false;
      }

      this.logger.info(
        {
          traceId,
          paymentChannelReferenceId,
        },
        'bKash subscription cancelled successfully',
      );

      return true;
    } catch (error) {
      this.logger.error(
        {
          traceId,
          paymentChannelReferenceId,
          error,
        },
        'Exception during bKash subscription cancellation',
      );
      return false;
    }
  }
}
