import { Module } from '@nestjs/common';
import { HttpClientModule } from 'src/common/http-client/http-client.module';
import { BanglalinkPaymentService } from './banglalink.payment.service';
import { BkashPaymentService } from './bkash.payment.service';
import { GpPaymentService } from './gp.payment.service';
import { NagadPaymentService } from './nagad.payment.service';
import { PaymentService } from './payment.service';
import { RobiPaymentService } from './robi.payment.service';
import { SSLPaymentService } from './ssl.payment.service';

@Module({
  imports: [HttpClientModule],
  providers: [
    PaymentService,
    GpPaymentService,
    BanglalinkPaymentService,
    RobiPaymentService,
    BkashPaymentService,
    SSLPaymentService,
    NagadPaymentService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
