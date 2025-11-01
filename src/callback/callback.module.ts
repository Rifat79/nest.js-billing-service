import { Module } from '@nestjs/common';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { CallbackController } from './callback.controller';
import { CallbackService } from './callback.service';

@Module({
  imports: [SubscriptionModule],
  controllers: [CallbackController],
  providers: [CallbackService],
  exports: [CallbackService],
})
export class CallbackModule {}
