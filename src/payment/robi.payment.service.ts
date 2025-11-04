import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { HttpClientService } from 'src/common/http-client/http-client.service';

export interface RobiChargeConfig {
  apiKey: string;
  username: string;
  onBehalfOf: string;
  subscriptionName: string;
  description: string;
  purchaseCategoryCode: string;
  channel: string;
  unSubURL: string;
  contactInfo: string;
  subscriptionDuration: number;
}

export interface RobiChargeRequestPayload {
  subscriptionId: string;
  currency: string;
  amount: number;
  referenceCode: string;
  msisdn: string;
  config: RobiChargeConfig;
}

export interface RobiCancelAocTokenPayload {
  subscriptionId: string;
  msisdn: string;
  config: RobiChargeConfig;
}

export interface RobiPaymentServiceConfig {
  baseUrl: string;
  timeout: number;
  callbackUrl: string;
  aocPageUrl: string;
}

interface AocTokenResponse {
  data: {
    aocToken?: string;
    aocTransID?: string;
    errorCode?: string;
    errorMessage?: string;
    [key: string]: unknown;
  };
}

interface AocChargingStatusResponse {
  data: {
    transactionOperationStatus: string;
    [key: string]: unknown;
  };
}

interface AocCancelTokenResponse {
  data: {
    errorCode: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class RobiPaymentService {
  private readonly config: RobiPaymentServiceConfig;

  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClientService,
  ) {
    this.config = {
      baseUrl: this.configService.get<string>('ROBI_BASE_URL') ?? '',
      timeout: this.configService.get<number>('ROBI_TIMEOUT') ?? 5000,
      callbackUrl: this.configService.get<string>(
        'COMMON_REDIRECT_URL',
        'http://localhost:3080',
      ),
      aocPageUrl: this.configService.get<string>('ROBI_AOC_PAGE_URL') ?? '',
    };
    this.logger.setContext(RobiPaymentService.name);
  }

  async getAocToken(
    data: RobiChargeRequestPayload,
  ): Promise<{ url: string; aocTransID: string }> {
    const { amount, currency, referenceCode, msisdn, config } = data;
    const url = `${this.config.baseUrl}/getAOCToken`;

    const payload = {
      apiKey: config.apiKey,
      username: config.username,
      spTransID: referenceCode,
      description: config.description,
      currency,
      amount,
      onBehalfOf: config.onBehalfOf,
      purchaseCategoryCode: config.purchaseCategoryCode,
      referenceCode,
      channel: config.channel,
      operator: 'ROBI',
      taxAmount: 0,
      callbackURL: `${this.config.callbackUrl.replace(':subscriptionId', data.subscriptionId)}`,
      contactInfo: config.contactInfo,
      isSubscription: true,
      subscriptionID: config.subscriptionName,
      subscriptionName: config.subscriptionName,
      subscriptionDuration: config.subscriptionDuration,
      unSubURL: config.unSubURL,
    };

    try {
      this.logger.info(
        { msisdn, referenceCode, url, payload },
        'Initiating Robi AOC token request',
      );

      const response = await this.httpClient.post<AocTokenResponse>(
        url,
        payload,
        {
          timeout: this.config.timeout,
        },
      );

      const responseData = response.data?.data ?? {};
      const { aocToken, aocTransID } = responseData;

      if (!aocToken || !aocTransID) {
        this.logger.warn(
          { msisdn, referenceCode, response: response.data },
          'Robi AOC token generation failed: missing token',
        );
        throw new Error('Could not generate AOC Token');
      }

      const consentUrl = `${this.config.aocPageUrl}/aoc?aocToken=${encodeURIComponent(aocToken)}`;

      this.logger.info(
        { msisdn, referenceCode, consentUrl },
        'Robi AOC token generated successfully',
      );

      return { url: consentUrl, aocTransID };
    } catch (error) {
      this.logger.error(
        {
          error,
          msisdn,
          referenceCode,
          url,
        },
        'Robi AOC token request failed',
      );
      throw error;
    }
  }

  async getAocChargingStatus(
    aocTransID: string,
    chargeConfig: RobiChargeConfig,
  ): Promise<string | null> {
    const url = this.config.baseUrl + '/chargeStatus';

    const payload = {
      aocTransID,
      apiKey: chargeConfig.apiKey,
      username: chargeConfig.username,
    };

    const response = await this.httpClient.post<AocChargingStatusResponse>(
      url,
      payload,
      { timeout: this.config.timeout },
    );

    if (response.error || !response.data?.data.transactionOperationStatus) {
      return null;
    }

    return response.data.data.transactionOperationStatus;
  }

  async cancelAocToken(data: RobiCancelAocTokenPayload): Promise<boolean> {
    const { subscriptionId, msisdn, config } = data;
    const traceId = `robi-cancel-${subscriptionId}`;
    const url = this.config.baseUrl + '/cancelSubscription';

    const payload = {
      apiKey: config.apiKey,
      username: config.username,
      spTransID: subscriptionId,
      operator: 'ROBI',
      subscriptionID: config.subscriptionName,
      msisdn,
    };

    try {
      this.logger.info(
        { traceId, msisdn, subscriptionId, url, payload },
        'Initiating Robi AOC cancellation request',
      );

      const response = await this.httpClient.post<AocCancelTokenResponse>(
        url,
        payload,
        {
          timeout: this.config.timeout,
        },
      );

      const responseData = (response.data?.data ?? {}) as Partial<
        AocCancelTokenResponse['data']
      >;
      const isSuccessful = responseData.errorCode === '00';

      if (!isSuccessful) {
        this.logger.warn(
          {
            traceId,
            msisdn,
            subscriptionId,
            responsePayload: responseData,
          },
          'Robi AOC cancellation failed: non-zero error code',
        );
        return false;
      }

      this.logger.info(
        {
          traceId,
          msisdn,
          subscriptionId,
          responsePayload: responseData,
        },
        'Robi AOC cancellation successful',
      );

      return true;
    } catch (error) {
      this.logger.error(
        {
          traceId,
          msisdn,
          subscriptionId,
          error,
        },
        'Exception during Robi AOC cancellation',
      );
      return false;
    }
  }
}
