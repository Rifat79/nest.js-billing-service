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
          console.log('Validation Errors:', JSON.stringify(errors, null, 2));
          return new RpcException({
            statusCode: 400,
            message: 'Validation failed',
            error: 'BAD_REQUEST',
            details: errors.map((err) => ({
              property: err.property,
              constraints: err.constraints,
              value: err.value,
            })),
          });
        },
      }),
  );
