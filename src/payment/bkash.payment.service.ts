import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { HttpClientService } from 'src/common/http-client/http-client.service';

interface BkashPaymentServiceConfig {
  baseUrl: string;
  timeout: number;
  callbackUrl: string;
}

export interface BkashChargeConfig {
  serviceId: string;
  merchantShortCode: string;
  apiKey: string;
}

interface CreateSubscriptionPayload {
  amount: number;
  validityInDays: number;
  subscriptionRequestId: string;
  initialPaymentAmount: number;
  config: BkashChargeConfig;
}

interface CreateSubscriptionResponse {
  redirectURL?: string;
  [key: string]: unknown;
}

interface BkashCheckPaymentStatusResponse {
  status: string;
}
@Injectable()
export class BkashPaymentService {
  private readonly config: BkashPaymentServiceConfig;

  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClientService,
  ) {
    this.config = {
      baseUrl: this.configService.get('BKASH_RECURRING_BASE_URL') ?? '',
      timeout: this.configService.get('BKASH_TIMEOUT') ?? 5000,
      callbackUrl: this.configService.get('BKASH_CALLBACK_URL') ?? '',
    };
  }

  async createSubscription(data: CreateSubscriptionPayload): Promise<string> {
    const { subscriptionRequestId, config } = data;
    const url = this.config.baseUrl + '/subscription';

    try {
      const payload = {
        amount: data.amount,
        amountQueryUrl: null,
        firstPaymentAmount: data.initialPaymentAmount,
        firstPaymentIncludedInCycle: true,
        serviceId: data.config?.serviceId,
        currency: 'BDT',
        startDate: this.getCurrentDate(),
        expiryDate: this.getDatePlusFiveYears(),
        frequency: this.getChargingFrequency(data.validityInDays),
        subscriptionType: 'WITH_PAYMENT',
        maxCapAmount: null,
        maxCapRequired: false,
        merchantShortCode: data.config?.merchantShortCode,
        payer: null,
        payerType: 'CUSTOMER',
        paymentType: 'FIXED',
        redirectUrl: `${this.config.callbackUrl}/${data.subscriptionRequestId}`,
        subscriptionRequestId: data.subscriptionRequestId,
        subscriptionReference: data.subscriptionRequestId,
        extraParams: null,
      };

      const response = await this.httpClient.post<CreateSubscriptionResponse>(
        url,
        payload,
        {
          headers: this.getHeaders(config.apiKey),
          timeout: this.config.timeout,
        },
      );

      const { redirectURL } = response.data ?? {};

      if (!redirectURL) {
        this.logger.warn(
          { subscriptionRequestId, response },
          'Bkash create subscription failed: missing redirectURL',
        );
        throw new Error('Could not get redirect url');
      }

      return redirectURL;
    } catch (error) {
      this.logger.error(
        {
          error,
          subscriptionRequestId,
          url,
        },
        'Bkash create subscription request failed',
      );
      throw error;
    }
  }

  async queryPaymentStatusWithRequestId(
    requestId: string,
    config: BkashChargeConfig,
  ): Promise<string | null> {
    const url =
      this.config.baseUrl + '/subscriptions/request-id' + '/' + requestId;

    const response = await this.httpClient.get<BkashCheckPaymentStatusResponse>(
      url,
      {
        headers: this.getHeaders(config.apiKey),
        timeout: this.config.timeout,
      },
    );

    if (response.error && !response.data?.status) {
      this.logger.warn(
        { requestId, error: response.error },
        'Bkash payment status query failed',
      );
      return null;
    }

    return response.data?.status ?? null;
  }

  private getHeaders(apiKey: string | undefined) {
    const currentTimestamp = new Date().toISOString();
    return {
      version: 'v1.0',
      channelId: 'Merchant WEB',
      timeStamp: currentTimestamp,
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    };
  }

  private getCurrentDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getDatePlusFiveYears() {
    // Get the current date
    const currentDate = new Date();

    // Add 5 years to the current year
    const futureYear = currentDate.getFullYear() + 5;

    // Set the year to the future year
    currentDate.setFullYear(futureYear);

    // Get the year, month, and day
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed in JavaScript
    const day = String(currentDate.getDate()).padStart(2, '0');

    // Return the formatted date
    return `${year}-${month}-${day}`;
  }

  private getChargingFrequency(validity: number /* in days */) {
    switch (validity) {
      case 1:
        return 'DAILY';
      case 7:
        return 'WEEKLY';
      case 15:
        return 'FIFTEEN_DAYS';
      case 30:
        return 'THIRTY_DAYS';
      case 90:
        return 'NINETY_DAYS';
      case 180:
        return 'ONE_EIGHTY_DAYS';
      case 365:
        return 'CALENDAR_YEAR';

      default:
        return 'DAILY';
    }
  }
}
