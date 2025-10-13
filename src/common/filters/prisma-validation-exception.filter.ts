import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Catch(Prisma.PrismaClientValidationError)
export class PrismaValidationExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    this.logger.error(
      {
        path: request.url,
        method: request.method,
        error: exception.message,
      },
      'Prisma validation error occurred',
    );

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid data provided',
      error:
        process.env.NODE_ENV === 'development' ? exception.message : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
