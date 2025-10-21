import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class AocRedirectionDto {
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsOptional()
  body: Record<string, any>;

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

  @IsOptional()
  @IsNumber()
  timestamp?: number;
}
