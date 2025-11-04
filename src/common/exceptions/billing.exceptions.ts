import { RpcError } from './rpc-error';

export class ChargeConfigNotFoundException extends RpcError {
  constructor(channelId: number, productId: number, planId: number) {
    super(
      'CHARGE_CONFIG_NOT_FOUND',
      `Charge config not found for channel=${channelId}, product=${productId}, plan=${planId}`,
      404,
      { channelId, productId, planId },
    );
  }
}

export class CancellationStrategyNotFoundException extends RpcError {
  constructor(provider: string) {
    super(
      'CANCELLATION_STRATEGY_NOT_FOUND',
      `Cancellation strategy not found for provider=${provider}`,
      404,
      { provider },
    );
  }
}

export class UnsupportedProviderException extends RpcError {
  constructor(provider: string) {
    super(
      'UNSUPPORTED_PROVIDER',
      `Unsupported payment provider: ${provider}`,
      400,
      { provider },
    );
  }
}

export class NoUrlReturnedException extends RpcError {
  constructor(provider: string, msisdn: string, subscriptionId: string) {
    super(
      'NO_URL_RETURNED',
      `No URL returned from ${provider} payment service`,
      502,
      { provider, msisdn, subscriptionId },
    );
  }
}

export class SubscriptionNotFoundException extends RpcError {
  constructor(subscriptionId: string) {
    super(
      'SUBSCRIPTION_NOT_FOUND',
      `No subscription was found with '${subscriptionId}'`,
      404,
      { subscriptionId },
    );
  }
}

export class SubscriptionCancelUpstreamException extends RpcError {
  constructor(subscriptionId: string, operator: string) {
    super(
      'SUBSCRIPTION:CANCEL:FAILED',
      `Operator "${operator}" failed to cancel subscription with ID: ${subscriptionId}`,
      502,
      {
        subscriptionId,
        operator,
        context: 'SubscriptionCancelFailedException',
      },
    );
  }
}

export class PlanPricingNotFoundException extends RpcError {
  constructor() {
    super('PLAN_PRICING_NOT_FOUND', `Plan pricing not found`, 404);
  }
}
