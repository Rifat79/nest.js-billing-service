import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class WebhookMetaDto {
  @IsString()
  provider: 'BL' | 'BKASH';

  [key: string]: any;
}

export class WebhookReceiverDto {
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ValidateIf((o: WebhookReceiverDto) =>
    ['BL', 'BKASH'].includes(o.meta?.provider),
  )
  @IsDefined({ message: 'body is required when provider is BL or BKASH' })
  @IsObject({ message: 'body must be a valid object' })
  body?: Record<string, any>;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  query?: Record<string, any>;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  params?: Record<string, any>;

  @IsDefined()
  @ValidateNested()
  @Type(() => WebhookMetaDto)
  meta: WebhookMetaDto;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsNumber()
  timestamp?: number;
}
