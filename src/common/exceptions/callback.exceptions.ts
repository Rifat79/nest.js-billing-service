import { RpcError } from './rpc-error';

export class CallbackStrategyNotFoundException extends RpcError {
  constructor(provider: string) {
    super(
      'STRATEGY_NOT_FOUND',
      `Callback strategy was not found for provider=${provider}`,
      404,
      { provider },
    );
  }
}
