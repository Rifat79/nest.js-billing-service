import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { HttpClientService } from 'src/common/http-client/http-client.service';

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
  merchant: string;
};
// TODO: implement it
interface GpChargeConfig {
  keyword: string;
  category?: string;
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
        merchant,
      } = data;

      const API_GATEWAY_BASE_URL =
        this.configService.get<string>('app.apiGwBaseUrl');
      const url = this.config.baseUrl + '/partner/v3/consent/prepare';

      const payload = {
        amount,
        currency,
        productDescription,
        subscriptionPeriod: this.getSubscriptionPeriod(durationCountDays),
        urls: {
          ok: `${API_GATEWAY_BASE_URL}/api/v2/billing/redirection/${subscriptionId}?status=success`,
          deny: `${API_GATEWAY_BASE_URL}/api/v2/billing/redirection/${subscriptionId}?status=cancel`,
          error: `${API_GATEWAY_BASE_URL}/api/v2/billing/redirection/${subscriptionId}?status=fail`,
        },
        msisdn,
        merchant,
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
