import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @MaxLength(64, { message: 'transactionId must not exceed 64 characters' })
  @IsNotEmpty()
  transactionId: string;
}
