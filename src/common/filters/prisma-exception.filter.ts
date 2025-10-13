import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const errorCode = exception.code;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    switch (errorCode) {
      case 'P2000':
        status = HttpStatus.BAD_REQUEST;
        message = 'The provided value is too long for the column';
        break;
      case 'P2001':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = `Unique constraint failed on field: ${this.extractFieldName(exception)}`;
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Foreign key constraint failed';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record to update or delete not found';
        break;
      case 'P2024':
        status = HttpStatus.REQUEST_TIMEOUT;
        message = 'Connection pool timeout';
        break;
      case 'P2034':
        status = HttpStatus.CONFLICT;
        message = 'Transaction conflict, please retry';
        break;
      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database operation failed';
    }

    this.logger.error(
      {
        errorCode,
        path: request.url,
        method: request.method,
        meta: exception.meta,
        clientVersion: exception.clientVersion,
      },
      'Prisma client error occurred',
    );

    response.status(status).json({
      statusCode: status,
      message,
      error: process.env.NODE_ENV === 'development' ? errorCode : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private extractFieldName(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    const meta = exception.meta as any;
    if (meta?.target) {
      return Array.isArray(meta.target) ? meta.target.join(', ') : meta.target;
    }
    return 'unknown';
  }
}
