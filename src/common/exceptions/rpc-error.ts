import { RpcException } from '@nestjs/microservices';

export class RpcError extends RpcException {
  constructor(code: string, message: string, status = 500, details?: any) {
    super({ code, message, status, details });
  }
}
