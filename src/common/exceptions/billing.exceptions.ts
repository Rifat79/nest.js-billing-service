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
