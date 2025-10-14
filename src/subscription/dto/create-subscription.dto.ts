import {
  IsEnum,
  IsMobilePhone,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';
import { PaymentProvider } from 'src/common/enums/payment-providers';

export class SubscriptionBodyDto {
  @Transform(
    ({ value, obj }: { value: unknown; obj: Record<string, unknown> }) => {
      // Safely access obj.transaction_id if it exists and is a string
      if (value !== undefined && value !== null) return value;
      if (typeof obj.transaction_id === 'string') return obj.transaction_id;
      return undefined;
    },
  )
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

  @ValidateIf(
    (o: SubscriptionBodyDto) =>
      o.paymentProvider !== PaymentProvider.BANGLALINK,
  )
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
  body: SubscriptionBodyDto;

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
