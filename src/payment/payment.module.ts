import { Module } from '@nestjs/common';
import { HttpClientModule } from 'src/common/http-client/http-client.module';
import { GpPaymentService } from './gp.payment.service';
import { PaymentService } from './payment.service';

@Module({
  imports: [HttpClientModule],
  providers: [PaymentService, GpPaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
