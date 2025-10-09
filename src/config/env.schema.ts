import { z } from 'zod';

export const envSchema = z.object({
  // app
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']),
  BILLING_SERVICE_HOST: z.string().min(1),
  BILLING_SERVICE_PORT: z.coerce.number().int().positive(),
  BILLING_SERVICE_HTTP_PORT: z.coerce.number().int().positive(),

  // RabbitMQ
  RMQ_HOST: z.string().min(1),
  RMQ_PORT: z.coerce.number().int().positive(),
  RMQ_USER: z.string().min(1),
  RMQ_PASS: z.string().min(1),
  NOTIFICATION_QUEUE_NAME: z.string().min(1),

  // log
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .optional()
    .default('info'),
});

export type EnvVars = z.infer<typeof envSchema>;
