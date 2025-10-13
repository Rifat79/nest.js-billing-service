import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Catch(Prisma.PrismaClientInitializationError)
export class PrismaInitializationExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(
    exception: Prisma.PrismaClientInitializationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    this.logger.fatal(
      {
        errorCode: exception.errorCode,
        path: request.url,
        method: request.method,
        clientVersion: exception.clientVersion,
      },
      'Prisma client initialization error - database connection failed',
    );

    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Database service unavailable',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
