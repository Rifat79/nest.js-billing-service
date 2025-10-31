import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { catchError, Observable, tap } from 'rxjs';

@Injectable()
export class TcpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const rpcContext = context.switchToRpc();
    const data = rpcContext.getData();

    return next.handle().pipe(
      tap(() => {
        this.logger.info({ payload: data }, 'TCP request succeeded');
      }),
      catchError((err) => {
        this.logger.error({ payload: data, err }, 'TCP request failed');
        throw err;
      }),
    );
  }
}
