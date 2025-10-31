import { RpcError } from './rpc-error';

export class PlanNotFoundException extends RpcError {
  constructor(name: string, channelId: number, amount: number) {
    super(
      'PLAN_NOT_FOUND',
      `No plan found for product "${name}" with channel=${channelId} and amount=${amount}`,
      404,
      { name, channelId, amount },
    );
  }
}
