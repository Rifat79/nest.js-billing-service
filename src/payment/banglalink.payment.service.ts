import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { HttpClientService } from 'src/common/http-client/http-client.service';

export interface BanglalinkPaymentConfig {
  consentUrl: string;
  activation: string;
  deactivation: string;
  timeout: number;
}

export interface BanglalinkChargeConfig {
  planId: string;
  chargeCode: string;
}

interface InitActivationPayload {
  amount: number;
  requestId: string;
  msisdn: string;
  chargeConfig: BanglalinkChargeConfig;
}

export interface BanglalinkInitDeactivationPayload {
  amount: number;
  requestId: string;
  msisdn: string;
  chargeConfig: BanglalinkChargeConfig;
}

export interface BanglalinkPinVerificationPayload {
  requestId: string;
  msisdn: string;
  consentNo: string;
  chargeConfig: BanglalinkChargeConfig;
}

interface BanglalinkActivationResponse {
  responseCode?: string;
  [key: string]: unknown;
}

interface BanglalinkDeActivationResponse {
  responseCode?: string;
  [key: string]: unknown;
}

interface BanglalinkPinVerificationResponse {
  responseCode?: string;
  [key: string]: unknown;
}

export interface BanglalinkDeactivationResult {
  success: boolean;
  responseCode?: string;
  raw?: BanglalinkDeActivationResponse;
}

export interface BanglalinkPinVerificationResult {
  success: boolean;
  responseCode?: string;
  raw?: BanglalinkDeActivationResponse;
}

@Injectable()
export class BanglalinkPaymentService {
  private readonly config: BanglalinkPaymentConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClientService,
    private readonly logger: PinoLogger,
  ) {
    this.config = {
      consentUrl: this.configService.get<string>('BL_CONSENT_URL') ?? '',
      activation: this.configService.get<string>('BL_SDP_ACTIVATE') ?? '',
      deactivation: this.configService.get<string>('BL_SDP_DEACTIVATE') ?? '',
      timeout: this.configService.get<number>('BL_TIMEOUT') ?? 5000,
    };
  }

  async initActivation(data: InitActivationPayload): Promise<string> {
    const { amount, requestId, msisdn, chargeConfig } = data;

    if (!chargeConfig?.planId || !chargeConfig?.chargeCode) {
      this.logger.warn(
        { msisdn, requestId, chargeConfig },
        'Missing Banglalink charge configuration',
      );
      throw new Error('Invalid Banglalink charge configuration');
    }

    const queryObject = {
      planId: chargeConfig.planId,
      chargecode: chargeConfig.chargeCode,
      featureId: 'ACTIVATION',
      amount,
      requestId,
      msisdn,
    };

    const url = `${this.config.activation}?${this.prepareQueryString(queryObject)}`;

    try {
      this.logger.info(
        { msisdn, requestId, url },
        'Initiating Banglalink activation request',
      );

      const response = await this.httpClient.get<BanglalinkActivationResponse>(
        url,
        {
          timeout: this.config.timeout,
        },
      );

      const responseData = response.data;
      const isSuccessful = responseData?.responseCode === '0';

      if (!isSuccessful) {
        this.logger.warn(
          { msisdn, requestId, responseData },
          'Banglalink activation failed: non-zero response code',
        );
        throw new Error('Banglalink activation failed');
      }

      const consentUrl = `${this.config.consentUrl}/bl-dob/consent?token=${encodeURIComponent(requestId)}`;
      this.logger.info(
        { msisdn, requestId, consentUrl },
        'Banglalink activation successful',
      );

      return consentUrl;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : error,
          msisdn,
          requestId,
          url,
        },
        'Banglalink activation encountered an error',
      );
      throw error;
    }
  }

  async initDeactivation(
    data: BanglalinkInitDeactivationPayload,
  ): Promise<BanglalinkDeactivationResult> {
    const { msisdn, amount, requestId } = data;
    const chargeConfig = data.chargeConfig as BanglalinkChargeConfig;

    if (!chargeConfig?.planId || !chargeConfig?.chargeCode) {
      this.logger.warn(
        { msisdn, requestId, chargeConfig },
        'Missing Banglalink charge configuration for deactivation',
      );
      throw new Error('Invalid Banglalink charge configuration');
    }

    const queryObject = {
      planId: chargeConfig.planId,
      chargecode: chargeConfig.chargeCode,
      featureId: 'DEACTIVATION',
      amount,
      requestId,
      msisdn,
    };

    const url = `${this.config.deactivation}?${this.prepareQueryString(queryObject)}`;

    try {
      this.logger.info(
        { msisdn, requestId, url },
        'Initiating Banglalink deactivation request',
      );

      const response =
        await this.httpClient.get<BanglalinkDeActivationResponse>(url, {
          timeout: this.config.timeout,
        });

      const responseData = response.data;
      const isSuccessful = responseData?.responseCode === '0';

      if (!isSuccessful) {
        this.logger.warn(
          { msisdn, requestId, responseData },
          'Banglalink deactivation failed: non-zero response code',
        );
      } else {
        this.logger.info(
          { msisdn, requestId, responseData },
          'Banglalink deactivation successful',
        );
      }

      return {
        success: isSuccessful,
        responseCode: responseData?.responseCode,
        raw: responseData ?? undefined,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : error,
          msisdn,
          requestId,
          url,
        },
        'Banglalink deactivation encountered an error',
      );
      throw error;
    }
  }

  async submitConsent(
    data: BanglalinkPinVerificationPayload,
  ): Promise<BanglalinkPinVerificationResult> {
    const { msisdn, requestId, consentNo } = data;
    const chargeConfig = data.chargeConfig as unknown as BanglalinkChargeConfig;

    if (!chargeConfig?.planId || !chargeConfig?.chargeCode) {
      this.logger.warn(
        { msisdn, requestId, chargeConfig },
        'Missing Banglalink charge configuration for pin verification',
      );
      throw new Error('Invalid Banglalink charge configuration');
    }

    const queryObject = {
      planId: chargeConfig.planId,
      chargecode: chargeConfig.chargeCode,
      featureId: 'CONSENT',
      consentNo,
      requestId,
      msisdn,
    };

    const url = `${this.config.activation}?${this.prepareQueryString(queryObject)}`;

    try {
      this.logger.info(
        { msisdn, requestId, url },
        'Initiating Banglalink pin verification request',
      );

      const response =
        await this.httpClient.get<BanglalinkPinVerificationResponse>(url, {
          timeout: this.config.timeout,
        });

      const responseData = response.data;
      const isSuccessful = responseData?.responseCode === '0';

      if (!isSuccessful) {
        this.logger.warn(
          { msisdn, requestId, responseData },
          'Banglalink pin verification  failed: non-zero response code',
        );
      } else {
        this.logger.info(
          { msisdn, requestId, responseData },
          'Banglalink pin verification  successful',
        );
      }

      return {
        success: isSuccessful,
        responseCode: responseData?.responseCode,
        raw: responseData ?? undefined,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : error,
          msisdn,
          requestId,
          url,
        },
        'Banglalink pin verification  encountered an error',
      );
      throw error;
    }
  }

  private prepareQueryString(params: Record<string, unknown>): string {
    return Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      )
      .join('&');
  }
}
