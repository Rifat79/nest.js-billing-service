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
  params?: Record<string, any>;

  @IsString()
  @IsOptional()
  requestId?: string;

  // ✅ Enriched Fields

  @IsOptional()
  @IsNumber()
  timestamp?: number;
}
