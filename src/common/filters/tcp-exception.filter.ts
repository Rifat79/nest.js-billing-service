import { ArgumentsHost, Catch, RpcExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';

@Catch()
export class TcpExceptionFilter implements RpcExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: any, host: ArgumentsHost): Observable<any> {
    const ctx = host.switchToRpc();
    const data = ctx.getData();

    this.logger.error(
      {
        exception,
        payload: data,
      },
      'Unhandled TCP exception',
    );

    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    return throwError(() => ({
      code: 'UNHANDLED_EXCEPTION',
      message: exception?.message || 'Internal server error',
    }));
  }
}
