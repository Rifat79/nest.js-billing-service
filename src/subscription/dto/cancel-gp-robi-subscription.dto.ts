// import { Transform, Type } from 'class-transformer';
// import {
//   IsDefined,
//   IsNumber,
//   IsObject,
//   IsOptional,
//   IsString,
//   ValidateIf,
//   ValidateNested,
// } from 'class-validator';
// import { PaymentProvider } from 'src/common/enums/payment-providers';

// export class CancelSubscriptionBodyDto {
//   @ValidateIf((_obj, value) => value !== undefined)
//   @Transform(({ obj }: { obj: Record<string, unknown> }) => {
//     const txId =
//       typeof obj.transaction_id === 'string'
//         ? obj.transaction_id
//         : typeof obj.transactionId === 'string'
//           ? obj.transactionId
//           : undefined;
//     return txId ?? '';
//   })
//   @IsString()
//   transactionId?: string;

//   @ValidateIf((_obj, value) => value !== undefined)
//   @Transform(({ value }: { value: unknown }) => {
//     if (typeof value === 'string' && value.length >= 10) {
//       return '880' + value.slice(-10);
//     }
//     return value;
//   })
//   @IsString()
//   msisdn?: string;

//   @ValidateIf((_obj, value) => value !== undefined)
//   @IsString()
//   provider?: PaymentProvider;
// }

// export class CancelSubscriptionDto {
//   @IsObject()
//   @IsOptional()
//   headers?: Record<string, string>;

//   @ValidateNested()
//   @Type(() => CancelSubscriptionBodyDto)
//   @IsDefined()
//   body: CancelSubscriptionBodyDto;

//   @IsObject()
//   @IsOptional()
//   query?: Record<string, any>;

//   @IsObject()
//   @IsOptional()
//   params?: Record<string, any>;

//   @IsOptional()
//   @IsString()
//   requestId?: string;

//   @IsOptional()
//   @IsString()
//   planPricingId?: string;

//   @IsOptional()
//   @IsNumber()
//   timestamp?: number;

//   @Transform(({ obj }: { obj: CancelSubscriptionDto }) => {
//     const fromParams =
//       typeof obj.params?.subscriptionId === 'string'
//         ? obj.params.subscriptionId
//         : undefined;
//     return fromParams ?? '';
//   })
//   @IsOptional()
//   @IsString()
//   subscriptionId?: string;

//   @ValidateIf((o: CancelSubscriptionDto) => !o.subscriptionId)
//   @IsDefined()
//   get transactionId(): string {
//     return typeof this.body?.transactionId === 'string'
//       ? this.body.transactionId
//       : '';
//   }

//   @ValidateIf((o: CancelSubscriptionDto) => !o.subscriptionId)
//   @IsDefined()
//   get msisdn(): string {
//     return typeof this.body?.msisdn === 'string' ? this.body.msisdn : '';
//   }

//   // @ValidateIf((o: CancelSubscriptionDto) => !o.subscriptionId)
//   // @IsDefined()
//   // get provider(): PaymentProvider {
//   //   return typeof this.body?.provider === 'string'
//   //     ? this.body.provider
//   //     : PaymentProvider.UNKNOWN;
//   // }
// }
