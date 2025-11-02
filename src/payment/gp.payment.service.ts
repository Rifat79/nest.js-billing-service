import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { HttpClientService } from 'src/common/http-client/http-client.service';

const transactionSourceChannel = {
  mygp: 'MYGP', // When traffic redirected or initiated from MyGP App
  selfWeb: 'SelfWeb', // When traffic initiated from the web site itself
  selfApp: 'SelfApp', // When traffic initiated from the App itself
  others: 'Others', // When traffic initiated from any other digital marketing channel like google, facebook, affiliated marketing etc.
};

export enum GpErrorCode {
  INSUFFICIENT_BALANCE = 'POL1000',
  CONSENT_REFUSED = 'POL0253',
  EXPIRED_REFERENCE = 'POL0001',
  BARRED_USER = 'POL2003',
  RATE_LIMITED = 'SVC1000',
  INVALID_REFERENCE = 'SVC0002',
  NO_VALID_ADDRESS = 'SVC0004',
  CHARGE_NOT_APPLIED = 'SVC0270',
  THRESHOLD_EXCEEDED = 'POL1001',
}

interface GpServiceException {
  messageId: string;
  text: string;
  variables?: string[];
}

interface GpPolicyException {
  messageId: string;
  text: string;
  variables?: string[];
}
interface RechargeAndBuyResponse {
  continueUrl: string;
}

interface GpRequestError {
  serviceException?: GpServiceException;
  policyException?: GpPolicyException;
}

export interface GpChargeError {
  requestError: GpRequestError;
}

export interface GpChargeErrorResponse {
  status: false;
  message: string;
  error: GpChargeError;
}

interface InitRechargeAndBuyPayload {
  paymentReference: string;
  customerReference: string;
  originalPaymentReference: string;
  successUrl: string;
  errorUrl: string;
  denyUrl: string;
}

interface GpPaymentServiceConfig {
  baseUrl: string;
  auth: {
    username: string;
    password: string;
  };
  timeout: number;
}

type PrepareConsentData = {
  msisdn: string;
  initialPaymentAmount: number;
  amount: number;
  currency: string;
  productDescription: string;
  durationCountDays: number;
  subscriptionId: string;
  config: GpChargeConfig;
};

export interface GpChargePayload {
  customerReference: string;
  consentId: string;
  subscriptionId: string;
  validity: number;
  amount: number;
  chargeConfig: GpChargeConfig;
  channel?: string | null;
}
export interface GpChargeConfig {
  keyword: string;
  category?: string;
  description?: string; // TODO: currently it's optional but might be mandatory for uniformity
}

@Injectable()
export class GpPaymentService {
  private readonly config: GpPaymentServiceConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClientService,
    private readonly logger: PinoLogger,
  ) {
    this.config = {
      baseUrl: this.configService.get('GP_BASE_URL') ?? '',
      auth: {
        username: this.configService.get('GP_BASIC_AUTH_USER') ?? '',
        password: this.configService.get('GP_BASIC_AUTH_PASS') ?? '',
      },
      timeout: this.configService.get('GP_TIMEOUT') ?? 5000,
    };
  }

  async prepareConsent(data: PrepareConsentData): Promise<string> {
    try {
      const {
        msisdn,
        initialPaymentAmount,
        amount,
        currency,
        productDescription,
        durationCountDays,
        subscriptionId,
        config,
      } = data;

      const url = this.config.baseUrl + '/partner/v3/consent/prepare';
      const redirectUrl = this.configService.get<string>(
        'COMMON_REDIRECT_URL',
        'http://localhost:3080',
      );

      const payload = {
        amount,
        currency,
        productDescription,
        subscriptionPeriod: this.getSubscriptionPeriod(durationCountDays),
        urls: {
          ok: `${redirectUrl.replace(':subscriptionId', subscriptionId)}?status=success`,
          deny: `${redirectUrl.replace(':subscriptionId', subscriptionId)}?status=cancel`,
          error: `${redirectUrl.replace(':subscriptionId', subscriptionId)}?status=fail`,
        },
        msisdn,
        merchant: config.keyword,
        operatorId: 'GRA-BD',
        freeTrialPeriod:
          initialPaymentAmount !== amount ? durationCountDays : null,
      };

      const response = await this.httpClient.post(
        url,
        payload,
        this.getAuthHeaders(),
      );

      return response.data.url;
    } catch (error) {
      this.logger.error(error, 'Catch block error in prepareConsent');
      throw error;
    }
  }

  async chargeWithConsent(data: GpChargePayload): Promise<{
    success: boolean;
    messageId?: string;
    messageText?: string;
  }> {
    const url = `${this.config.baseUrl}/partner/payment/v1/${data.customerReference}/transactions/amount`;

    const payload = {
      amountTransaction: {
        endUserId: data.customerReference,
        paymentAmount: {
          chargingInformation: {
            amount: data.amount,
            currency: 'BDT',
            description: data.chargeConfig.description,
          },
          chargingMetaData: {
            channel: data.channel ?? transactionSourceChannel.selfWeb,
            mandateId: {
              renew: true,
              subscription: data.subscriptionId,
              consentId: data.consentId,
              subscriptionPeriod: this.getSubscriptionPeriod(data.validity),
            },
            productId: data.chargeConfig.keyword,
            ...(data.chargeConfig.category && {
              purchaseCategoryCode: data.chargeConfig.category,
            }),
          },
        },
        referenceCode: data.subscriptionId,
        transactionOperationStatus: 'Charged',
        operatorId: 'GRA-BD',
      },
    };

    const traceId = `charge-${data.subscriptionId}`;
    const response = await this.httpClient.post(
      url,
      payload,
      this.getAuthHeaders(),
      traceId,
    );

    if (response.error) {
      const errData = response.data as GpChargeErrorResponse;
      const svc = errData?.error?.requestError?.serviceException;
      const pol = errData?.error?.requestError?.policyException;

      const messageId = svc?.messageId ?? pol?.messageId;
      const messageText = svc?.text ?? pol?.text;
      const variables = svc?.variables ?? pol?.variables;

      this.logger.warn({
        msg: 'GP charge failed',
        subscriptionId: data.subscriptionId,
        msisdn: data.customerReference,
        messageId,
        messageText,
        variables,
        traceId,
      });

      return {
        success: false,
        messageId,
        messageText,
      };
    }

    return { success: true };
  }

  async initRechargeAndBuy(
    data: InitRechargeAndBuyPayload,
  ): Promise<string | null> {
    const url =
      this.config.baseUrl +
      `/partner/payment/v1/${data.customerReference}/transactions/recharge/prepare`;

    const payload = {
      originalReferenceCode: data.originalPaymentReference,
      referenceCode: data.paymentReference,
      urls: {
        ok: data.successUrl,
        deny: data.errorUrl,
        error: data.errorUrl,
      },
    };

    const traceId = `recharge-${data.originalPaymentReference}`;
    const response = await this.httpClient.post<RechargeAndBuyResponse>(
      url,
      payload,
      this.getAuthHeaders(),
      traceId,
    );

    if (response.error || !response.data?.continueUrl) {
      this.logger.warn({
        msg: 'Recharge and buy failed',
        subscriptionId: data.originalPaymentReference,
        customerReference: data.customerReference,
        traceId,
        error: response.error,
      });
      return null;
    }

    this.logger.info({
      msg: 'Recharge and buy initiated',
      subscriptionId: data.originalPaymentReference,
      customerReference: data.customerReference,
      continueUrl: response.data.continueUrl,
      traceId,
    });

    return response.data.continueUrl;
  }

  private getAuthHeaders() {
    const credentials = `${this.config.auth.username}:${this.config.auth.password}`;
    const encoded = Buffer.from(credentials).toString('base64');

    return {
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      timeout: this.config.timeout,
    };
  }

  private getSubscriptionPeriod(validity: number) {
    switch (validity) {
      case 1:
        return 'P1D';
      case 7:
        return 'P1W';
      case 30:
        return 'P1M';
      case 180:
        return 'P6M';
      case 365:
        return 'P1Y';
      default:
        return 'P1D';
    }
  }
}
