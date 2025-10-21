// src/filters/rpc-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  HttpStatus,
  RpcExceptionFilter,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ValidationError } from 'class-validator';
import { PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';

const UNHANDLED_ERROR_RESPONSE = {
  code: 'UNHANDLED_EXCEPTION',
  message: 'An internal server error occurred.',
  httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
};

@Catch()
export class AllExceptionsFilter implements RpcExceptionFilter<any> {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): Observable<any> {
    let errorToClient: any;
    const logPayload: Record<string, any> = {
      context: String(host.getType()),
    };

    let logMessage = `RPC Exception Caught`;

    if (exception instanceof RpcException) {
      // 1. Handle Known RpcExceptions
      errorToClient = exception.getError();
      if (typeof errorToClient === 'string') {
        errorToClient = { code: 'RPC_ERROR', message: errorToClient };
      }

      logPayload.code = errorToClient.code;
      logPayload.message = errorToClient.message;
      logMessage = `[${errorToClient.code}] Known RPC Error`;
    } else if (exception instanceof Error) {
      // 2. Handle standard JavaScript Errors
      const errorMsg = exception.message;

      // Check if it's a BadRequestException from ValidationPipe
      // ValidationPipe throws BadRequestException with 'message' property as array
      if (
        (exception as any).response?.message &&
        Array.isArray((exception as any).response.message)
      ) {
        // 2a. Direct ValidationPipe BadRequestException
        const validationMessages = (exception as any).response.message;

        errorToClient = {
          code: 'VALIDATION_FAILED',
          message: 'Input validation failed.',
          details: validationMessages,
          httpStatus: HttpStatus.BAD_REQUEST,
        };

        logPayload.code = errorToClient.code;
        logPayload.validation_errors = validationMessages;
        logMessage = `[VALIDATION_FAILED] DTO Validation Error`;
      } else {
        // Try parsing as JSON (your original approach)
        try {
          const validationErrors: ValidationError[] = JSON.parse(errorMsg);

          if (
            Array.isArray(validationErrors) &&
            validationErrors[0] &&
            validationErrors[0].constraints
          ) {
            // 2b. DTO Validation Error from JSON parse
            const simplifiedDetails = validationErrors.map((e) => ({
              property: e.property,
              constraints: e.constraints ? Object.values(e.constraints) : [],
            }));

            errorToClient = {
              code: 'VALIDATION_FAILED',
              message: 'Input validation failed.',
              details: simplifiedDetails,
              httpStatus: HttpStatus.BAD_REQUEST,
            };

            logPayload.code = errorToClient.code;
            logPayload.validation_errors = simplifiedDetails;
            logMessage = `[VALIDATION_FAILED] DTO Validation Error`;
          } else {
            // 2c. Unhandled Standard JS Error
            errorToClient = UNHANDLED_ERROR_RESPONSE;
            logPayload.err = exception;
            logPayload.code = UNHANDLED_ERROR_RESPONSE.code;
            logPayload.message = exception.message;
            logMessage = `[${UNHANDLED_ERROR_RESPONSE.code}] Unhandled JS Error`;
          }
        } catch (e) {
          // 2d. Error was not JSON
          errorToClient = UNHANDLED_ERROR_RESPONSE;
          logPayload.err = exception;
          logPayload.code = UNHANDLED_ERROR_RESPONSE.code;
          logPayload.message = exception.message;
          logMessage = `[${UNHANDLED_ERROR_RESPONSE.code}] Fallback JS Error`;
        }
      }
    } else {
      // 3. Handle anything else
      errorToClient = UNHANDLED_ERROR_RESPONSE;
      logPayload.code = UNHANDLED_ERROR_RESPONSE.code;
      logPayload.unknown_exception = exception;
      logMessage = `[${UNHANDLED_ERROR_RESPONSE.code}] Unknown Throwable`;
    }

    // Structured Logging
    this.logger.error(logPayload, logMessage);

    return throwError(() => new RpcException(errorToClient));
  }
}
