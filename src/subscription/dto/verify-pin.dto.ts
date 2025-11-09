import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum VerifyPinProvider {
  BL = 'BL',
  TPAY = 'TPAY',
}

export class PathParamsDto {
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  path: [string, string, string];

  get subscriptionId(): string {
    return this.path[1];
  }
}

export class VerifyPinParamsDto {
  @IsString()
  subscriptionContractId: string;
}

export class VerifyPinBodyDto {
  @IsString()
  provider?: VerifyPinProvider;

  @IsString()
  subscriptionContractId: string;

  @IsString()
  pinCode: string;

  @IsString()
  operatorCode: string;

  @IsString()
  tpayTransactionId: string;

  @IsBoolean()
  charge?: boolean;
}

export class BlVerifyPinQueryDto {
  @IsOptional()
  @IsString()
  order_tracking_id?: string;

  @IsOptional()
  @IsString()
  consent_no?: string;
}

class MetaDto {
  @IsString()
  provider?: VerifyPinProvider;

  [key: string]: any;
}

export class VerifyPinDto {
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsOptional()
  @ValidateNested()
  @Type(() => VerifyPinBodyDto)
  body?: VerifyPinBodyDto;

  @IsObject()
  @IsOptional()
  query: BlVerifyPinQueryDto;

  @IsObject()
  params: PathParamsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetaDto)
  meta?: MetaDto;

  @IsString()
  @IsOptional()
  requestId?: string;

  // ✅ Enriched Fields

  @IsOptional()
  @IsNumber()
  timestamp?: number;
}
