import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import SSLCommerzPayment from 'sslcommerz-lts';

export interface SSLPaymentServiceConfig {
  clientBaseUrl?: string;
  ipnUrl: string;
  redirectUrl: string;
  storeId: string;
  storePass: string;
  isLive: boolean;
}

interface InitPaymentPayload {
  msisdn: string;
  amount: number;
  subscriptionId: string;
}

interface SSLInitResponse {
  status?: string;
  redirectGatewayURL?: string;
  sessionkey?: string;
  [key: string]: unknown;
}

export interface ElementStatus {
  status: string;
}

export interface ElementWrapper {
  element: ElementStatus[];
}

@Injectable()
export class SSLPaymentService {
  private readonly config: SSLPaymentServiceConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.config = {
      ipnUrl: this.configService.get<string>('SSL_IPN_URL', ''),
      redirectUrl: this.configService.get<string>(
        'COMMON_REDIRECT_URL',
        'http://localhost:3080',
      ),
      storeId: this.configService.get<string>('SSL_STORE_ID') ?? '',
      storePass: this.configService.get<string>('SSL_STORE_PASSWORD') ?? '',
      isLive: true,
    };
    this.logger.setContext(SSLPaymentService.name);
  }

  async initPayment(
    data: InitPaymentPayload,
  ): Promise<{ url: string; sessionKey: string }> {
    const { msisdn, amount, subscriptionId } = data;

    const ssl = new SSLCommerzPayment(
      this.config.storeId,
      this.config.storePass,
      this.config.isLive,
    );

    const redirectPath = `${this.config.redirectUrl.replace(':subscriptionId', subscriptionId)}`;

    const payload = {
      total_amount: amount,
      currency: 'BDT',
      tran_id: subscriptionId,
      success_url: `${this.config.redirectUrl.replace(':subscriptionId', subscriptionId)}?status=SUCCEEDED`,
      fail_url: `${this.config.redirectUrl.replace(':subscriptionId', subscriptionId)}?status=FAILED`,
      cancel_url: `${this.config.redirectUrl.replace(':subscriptionId', subscriptionId)}?status=CANCELLED`,
      ipn_url: this.config.ipnUrl,
      shipping_method: 'Courier',
      product_name: 'composite product',
      product_category: 'general',
      product_profile: 'general',
      cus_name: `customer_${msisdn}`,
      cus_email: 'alamin@momagicbd.com',
      cus_add1: 'Dhaka',
      cus_add2: 'Dhaka',
      cus_city: 'Dhaka',
      cus_state: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: msisdn,
      cus_fax: msisdn,
      ship_name: `customer_${msisdn}`,
      ship_add1: 'Dhaka',
      ship_add2: 'Dhaka',
      ship_city: 'Dhaka',
      ship_state: 'Dhaka',
      ship_postcode: '1000',
      ship_country: 'Bangladesh',
    };

    try {
      this.logger.info(
        { msisdn, subscriptionId, payload },
        'Initiating SSLCommerz payment',
      );

      const response = (await ssl.init(payload)) as SSLInitResponse;

      if (response.status !== 'SUCCESS') {
        this.logger.warn(
          { msisdn, subscriptionId, response },
          'SSLCommerz init failed: non-success status',
        );
        throw new Error('SSLCommerz init failed');
      }

      this.logger.info(
        {
          msisdn,
          subscriptionId,
          redirectUrl: response.redirectGatewayURL,
          sessionKey: response.sessionkey,
        },
        'SSLCommerz payment initialized successfully',
      );

      return {
        url: response.redirectGatewayURL!,
        sessionKey: response.sessionkey!,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : error,
          msisdn,
          subscriptionId,
        },
        'SSLCommerz payment initialization error',
      );
      throw error;
    }
  }

  async queryPaymentStatusWithTransactionId(
    tran_id: string,
  ): Promise<string | null> {
    const ssl = new SSLCommerzPayment(
      this.config.storeId,
      this.config.storePass,
      this.config.isLive,
    );

    const response = (await ssl.transactionQueryByTransactionId({
      tran_id,
    })) as ElementWrapper;

    if (!response?.element?.[0]?.status) {
      return null;
    }

    return response?.element?.[0]?.status;
  }
}
