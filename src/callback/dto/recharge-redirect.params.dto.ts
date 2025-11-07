import { IsEnum } from 'class-validator';
import { RedirectionStatus } from 'src/common/enums/subscription.enums';

import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsValidRedirectPath', async: false })
export class IsValidRedirectPathConstraint
  implements ValidatorConstraintInterface
{
  validate(path: any, args: ValidationArguments): boolean {
    if (!Array.isArray(path) || path.length !== 4) return false;
    const [prefix, id, suffix1, suffix2] = path;
    return (
      prefix === 'subscriptions' &&
      typeof id === 'string' &&
      id.length > 0 &&
      suffix2 === 'redirect'
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `params.path must follow ['subscriptions', ':subscriptionId', 'redirect']`;
  }
}

export class RechargeRedirectParamsDto {
  @IsArray()
  @Validate(IsValidRedirectPathConstraint)
  @Type(() => String)
  path: [string, string, string, string];

  @Transform(({ obj }) => obj.path?.[1])
  @IsString()
  subscriptionId: string;
}

export class RechargeRedirectQueryDto {
  @IsEnum(RedirectionStatus, {
    message: `status must be one of: ${Object.values(RedirectionStatus).join(', ')}`,
  })
  status: RedirectionStatus;
}
