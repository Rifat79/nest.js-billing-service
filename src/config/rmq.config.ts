import { registerAs } from '@nestjs/config';
import { validatedEnv } from './validate-env';

export default registerAs('rmq', () => {
  return {
    host: validatedEnv.RMQ_HOST,
    port: validatedEnv.RMQ_PORT,
    user: validatedEnv.RMQ_USER,
    password: validatedEnv.RMQ_PASS,
    queue: validatedEnv.NOTIFICATION_QUEUE_NAME,
    get url() {
      return `amqp://${this.user}:${this.password}@${this.host}:${this.port}`;
    },
  };
});
