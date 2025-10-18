import { registerAs } from '@nestjs/config';
import { validatedEnv } from './validate-env';

export default registerAs('app', () => {
  return {
    nodeEnv: validatedEnv.NODE_ENV,
    host: validatedEnv.BILLING_SERVICE_HOST,
    port: validatedEnv.BILLING_SERVICE_PORT,
    httpPort: validatedEnv.BILLING_SERVICE_HTTP_PORT,
    serviceName: validatedEnv.SERVICE_NAME,
  };
});
