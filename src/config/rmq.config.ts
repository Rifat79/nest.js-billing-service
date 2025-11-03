import { registerAs } from '@nestjs/config';
import { validatedEnv } from './validate-env';

export default registerAs('rmq', () => {
  return {
    host: validatedEnv.RMQ_HOST,
    port: validatedEnv.RMQ_PORT,
    user: validatedEnv.RMQ_USER,
    password: validatedEnv.RMQ_PASS,
    queues: {
      notifications: 'notifications.subscription.queue',
      notificationsDlq: 'notifications.subscription.dlq',
    },
    exchanges: {
      notifications: 'notifications.subscription.exchange',
      notificationsDlq: 'notifications.subscription.dlq.exchange',
    },
    routingKeys: {
      notification: 'notifications.subscription.send',
      notificationDlq: 'notifications.subscription.dlq',
    },
    retryAttempts: 3,
    retryDelay: 5000,

    get url() {
      const user = encodeURIComponent(this.user); // Encode username
      const password = encodeURIComponent(this.password); // Encode password
      return `amqp://${user}:${password}@${this.host}:${this.port}`;
    },
  };
});
