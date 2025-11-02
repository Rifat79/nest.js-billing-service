import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { HttpClientService } from 'src/common/http-client/http-client.service';
import { NagadCustomerRepository } from 'src/database/nagad-customer.repository';

export interface NagadPaymentServiceConfig {
  nagadPaymentServiceBaseUrl: string;
  createPaymentApi: string;
  paymentVerifyApi: string;
}

interface CreatePaymentPayload {
  msisdn: string;
  amount: number;
  subscriptionId: string;
}

interface CreatePaymentResponse {
  url: string;
  [key: string]: unknown;
}

interface VerifyPaymentResponse {
  status: string;
  [key: string]: unknown;
}

@Injectable()
export class NagadPaymentService {
  private readonly config: NagadPaymentServiceConfig;
  constructor(
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClientService,
    private readonly nagadCustomerRepo: NagadCustomerRepository,
  ) {
    this.config = {
      nagadPaymentServiceBaseUrl:
        this.configService.get('NAGAD_PAYMENT_SERVICE_URL') ?? '',
      paymentVerifyApi:
        this.configService.get('NAGAD_PAYMENT_VERIFY_API') ?? '',
      createPaymentApi:
        this.configService.get('NAGAD_CREATE_PAYMENT_API') ?? '',
    };
    this.logger.setContext(NagadPaymentService.name);
  }

  async createPayment(data: CreatePaymentPayload): Promise<string> {
    const { msisdn, amount, subscriptionId } = data;

    try {
      const customerNagadDetails = await this.nagadCustomerRepo.findUnique({
        msisdn,
      });

      const productDetails = {};

      let nagadPurpose = 'ECOM_TXN';
      let nagadCustomerId = msisdn;
      let nagadToken = '';

      if (customerNagadDetails) {
        nagadPurpose = 'ECOM_TOKEN_TXN';
        nagadCustomerId = customerNagadDetails.nagad_customer_id ?? '';
        nagadToken = customerNagadDetails.nagad_token ?? '';
      }

      const url = this.config.createPaymentApi;
      const payload = {
        amount,
        orderId: subscriptionId,
        productDetails,
        purpose: nagadPurpose,
        customerId: nagadCustomerId,
        paymentToken: nagadToken,
      };

      this.logger.info(payload, 'Sending Nagad payment request');

      const response = await this.httpClient.post<CreatePaymentResponse>(
        url,
        payload,
      );

      if (!response.data?.url) {
        this.logger.warn(payload, 'Nagad getting url failed: did not get url');
        throw new Error('Nagad create payment failed');
      }

      return response.data?.url;
    } catch (error) {
      this.logger.error(data, 'Nagad create payment catch block error');
      throw error;
    }
  }

  async verifyPayment(paymentRefId: string): Promise<string | null> {
    const url = `${this.config.paymentVerifyApi}?paymentRefId=${paymentRefId}`;
    const response = await this.httpClient.get<VerifyPaymentResponse>(url);

    if (response.error || !response.data?.status) {
      return null;
    }

    return response.data.status;
  }
}
