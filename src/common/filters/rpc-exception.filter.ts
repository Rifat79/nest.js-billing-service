// src/filters/rpc-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  HttpStatus,
  RpcExceptionFilter,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ValidationError } from 'class-validator'; // 👈 Import ValidationError type
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';

// Standardized error for unexpected issues (keep it safe)
const UNHANDLED_ERROR_RESPONSE = {
  code: 'UNHANDLED_EXCEPTION',
  message: 'An internal server error occurred.',
  httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
};

@Catch()
export class AllExceptionsFilter implements RpcExceptionFilter<any> {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): Observable<any> {
    let errorToClient: any;
    let logPayload: Record<string, any> = {
      context: host.getType(), // 'rpc'
    };

    // Default log message
    let logMessage = `RPC Exception Caught`;

    if (exception instanceof RpcException) {
      // 1. Handle Known RpcExceptions (Business Logic Errors)
      errorToClient = exception.getError();
      if (typeof errorToClient === 'string') {
        errorToClient = { code: 'RPC_ERROR', message: errorToClient };
      }

      logPayload.code = errorToClient.code;
      logPayload.message = errorToClient.message;
      logMessage = `[${errorToClient.code}] Known RPC Error`;
    } else if (exception instanceof Error) {
      // 2. Handle standard JavaScript Errors (includes ValidationPipe output)
      const errorMsg = exception.message;

      try {
        const validationErrors: ValidationError[] = JSON.parse(errorMsg);

        // Check if the parsed object looks like an array of ValidationErrors
        if (
          Array.isArray(validationErrors) &&
          validationErrors[0] &&
          validationErrors[0].constraints
        ) {
          // 2a. DTO Validation Error Handling
          const simplifiedDetails = validationErrors.map((e) => ({
            property: e.property,
            constraints: e.constraints ? Object.values(e.constraints) : [],
          }));

          errorToClient = {
            code: 'VALIDATION_FAILED',
            message: 'Input validation failed.',
            details: simplifiedDetails, // Send simplified details to the client
            httpStatus: HttpStatus.BAD_REQUEST,
          };

          logPayload.code = errorToClient.code;
          logPayload.validation_errors = simplifiedDetails; // Log detailed array
          logMessage = `[VALIDATION_FAILED] DTO Validation Error`;
        } else {
          // 2b. Unhandled Standard JS Error (e.g., Database, Network, general code crash)
          errorToClient = UNHANDLED_ERROR_RESPONSE;

          // Log the full Error object for stack trace analysis
          logPayload.err = exception;
          logPayload.code = UNHANDLED_ERROR_RESPONSE.code;
          logPayload.message = exception.message; // Keep original message in log, but not for client
          logMessage = `[${UNHANDLED_ERROR_RESPONSE.code}] Unhandled JS Error`;
        }
      } catch (e) {
        // 2c. Error was not JSON (a regular, unhandled JS Error)
        errorToClient = UNHANDLED_ERROR_RESPONSE;
        logPayload.err = exception;
        logPayload.code = UNHANDLED_ERROR_RESPONSE.code;
        logPayload.message = exception.message;
        logMessage = `[${UNHANDLED_ERROR_RESPONSE.code}] Fallback JS Error`;
      }
    } else {
      // 3. Handle anything else (e.g., throw 'a string' or an object)
      errorToClient = UNHANDLED_ERROR_RESPONSE;
      logPayload.code = UNHANDLED_ERROR_RESPONSE.code;
      logPayload.unknown_exception = exception;
      logMessage = `[${UNHANDLED_ERROR_RESPONSE.code}] Unknown Throwable`;
    }

    // Structured Logging
    this.logger.error(logPayload, logMessage);

    // Ensure the client always receives a clean RpcException
    return throwError(() => new RpcException(errorToClient));
  }
}
