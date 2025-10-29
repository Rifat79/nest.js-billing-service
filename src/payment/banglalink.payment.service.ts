import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpClientService } from 'src/common/http-client/http-client.service';

export interface BanglalinkPaymentConfig {
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

@Injectable()
export class BanglalinkPaymentService {
  private readonly config: BanglalinkPaymentConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClientService,
  ) {
    this.config = {
      activation: this.configService.get('BL_SDP_ACTIVATE') ?? '',
      deactivation: this.configService.get('BL_SDP_DEACTIVATE') ?? '',
      timeout: this.configService.get('BL_TIMEOUT') ?? 5000,
    };
  }

  async initActivation(data: InitActivationPayload): Promise<string> {
    const { amount, requestId, msisdn, chargeConfig } = data;

    let url = this.config.activation + '?';

    try {
      const queryObject = {
        planId: chargeConfig?.planId,
        chargecode: chargeConfig?.chargeCode,
        featureId: 'ACTIVATION',
        amount,
        requestId,
        msisdn,
      };
      url += this.prepareQueryString(queryObject);

      const response = await this.httpClient.get(url, {
        timeout: this.config.timeout,
      });
      return response.data;
    } catch (e) {
      console.log(
        '🚀 ~ BanglalinkPaymentService ~ initActivation ~ e:',
        e?.response?.data ?? e,
      );
      throw e;
    }
  }

  private prepareQueryString(params: Record<string, any>): string {
    return Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(
        ([key, value]) =>
          encodeURIComponent(key) + '=' + encodeURIComponent(String(value)),
      )
      .join('&');
  }
}
