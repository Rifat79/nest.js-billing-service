import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';
import { IsMobilePhone } from 'class-validator';
import { PaymentProvider } from 'src/common/enums/payment-providers';

export class SubscriptionBodyDto {
  @Transform(({ value, obj }) => value ?? obj.transaction_id)
  @IsString()
  @Length(1, 64, {
    message: 'transactionId must be between 1 and 64 characters',
  })
  transactionId: string;

  @IsString()
  keyword: string;

  @IsNumber()
  amount: number;

  @IsEnum(PaymentProvider)
  paymentProvider: PaymentProvider;

  @IsString()
  @IsMobilePhone('bn-BD')
  msisdn: string;

  @ValidateIf((o) => o.paymentProvider !== PaymentProvider.BANGLALINK)
  @IsObject()
  urls?: {
    success: string;
    deny: string;
    error: string;
  };
}

export class CreateSubscriptionDto {
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ValidateNested()
  @Type(() => SubscriptionBodyDto)
  body?: SubscriptionBodyDto;

  @IsObject()
  @IsOptional()
  query?: Record<string, any>;

  @IsObject()
  @IsOptional()
  params?: Record<string, any>;

  @IsString()
  @IsOptional()
  requestId?: string;

  // ✅ Enriched Fields

  @IsOptional()
  @IsString()
  planPricingId?: string;
}
