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

  async cretePayment(data: CreatePaymentPayload) {
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
        nagadCustomerId = customerNagadDetails.nagad_customer_id;
        nagadToken = customerNagadDetails.nagad_token;
      }
    } catch (error) {}
  }
}
