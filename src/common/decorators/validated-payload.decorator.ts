import { ValidationPipe } from '@nestjs/common';
import { Payload, RpcException } from '@nestjs/microservices';

export const ValidatedPayload = (validationPipe?: ValidationPipe) =>
  Payload(
    validationPipe ||
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },

        // These are crucial for seeing errors
        disableErrorMessages: false,
        validationError: {
          target: false,
          value: true,
        },

        exceptionFactory: (errors) => {
          const flattenErrors = (errors: any[], parentPath = ''): any[] =>
            errors.flatMap((err) => {
              const propertyPath = parentPath
                ? `${parentPath}.${err.property}`
                : err.property;
              const messages = err.constraints
                ? Object.values(err.constraints)
                : [];
              const children = err.children?.length
                ? flattenErrors(err.children, propertyPath)
                : [];

              return [
                ...(messages.length
                  ? [
                      {
                        property: propertyPath,
                        value: err.value,
                        messages,
                      },
                    ]
                  : []),
                ...children,
              ];
            });

          return new RpcException({
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'Payload validation failed',
            details: flattenErrors(errors),
          });
        },
      }),
  );
