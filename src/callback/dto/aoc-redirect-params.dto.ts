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
    if (!Array.isArray(path) || path.length !== 3) return false;
    const [prefix, id, suffix] = path;
    return (
      prefix === 'subscriptions' &&
      typeof id === 'string' &&
      id.length > 0 &&
      suffix === 'redirect'
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `params.path must follow ['subscriptions', ':subscriptionId', 'redirect']`;
  }
}

export class AocRedirectParamsDto {
  @IsArray()
  @Validate(IsValidRedirectPathConstraint)
  @Type(() => String)
  path: [string, string, string];

  @Transform(({ obj }) => obj.path?.[1])
  @IsString()
  subscriptionId: string;
}
