import { Expose, Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const BD_MSISDN_REGEX = /^(?:\+88|88)?01[3-9]\d{8}$/;

export class CancelSubscriptionParamsDto {
  @IsArray()
  @Type(() => String)
  @IsString({ each: true })
  path: string[];
}

export class CancelSubscriptionBodyDto {
  @Expose({ name: 'transaction_id' })
  @Transform(({ value, obj }) => {
    if (typeof value === 'string') return value;
    if (typeof obj?.transactionId === 'string') return obj.transactionId;
    return '';
  })
  @IsDefined()
  @IsString()
  transactionId: string;

  @Transform(({ value }) => {
    if (typeof value === 'string' && value.length >= 10) {
      return '880' + value.slice(-10);
    }
    return value;
  })
  @IsDefined()
  @IsString()
  @Matches(BD_MSISDN_REGEX, {
    message: 'msisdn must be a valid Bangladeshi mobile number',
  })
  msisdn: string;

  // @IsDefined()
  // @IsString()
  // provider: PaymentProvider;
}

export class CancelSubscriptionDto {
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ValidateNested()
  @Type(() => CancelSubscriptionBodyDto)
  body: CancelSubscriptionBodyDto;

  @IsObject()
  @IsOptional()
  query?: Record<string, any>;

  @IsObject()
  params: CancelSubscriptionParamsDto;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsNumber()
  timestamp?: number;

  @Transform(({ obj }: { obj: CancelSubscriptionDto }) => {
    const fromPath =
      Array.isArray(obj.params?.path) && obj.params.path.length > 0
        ? String(obj.params.path[obj.params.path.length - 1])
        : undefined;

    return fromPath ?? '';
  })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ValidateIf((o: CancelSubscriptionDto) => !o.subscriptionId)
  @IsDefined()
  get transactionId(): string {
    return typeof this.body?.transactionId === 'string'
      ? this.body.transactionId
      : '';
  }

  @ValidateIf((o: CancelSubscriptionDto) => !o.subscriptionId)
  @IsDefined()
  get msisdn(): string {
    return typeof this.body?.msisdn === 'string' ? this.body.msisdn : '';
  }

  // @ValidateIf((o: CancelSubscriptionDto) => !o.subscriptionId)
  // @IsDefined()
  // get provider(): PaymentProvider {
  //   return typeof this.body?.provider === 'string'
  //     ? this.body.provider
  //     : PaymentProvider.UNKNOWN;
  // }
}
