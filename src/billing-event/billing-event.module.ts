import { Module } from '@nestjs/common';
import { BillingEventService } from './billing-event.service';

@Module({
  providers: [BillingEventService],
  exports: [BillingEventService],
})
export class BillingEventModule {}
