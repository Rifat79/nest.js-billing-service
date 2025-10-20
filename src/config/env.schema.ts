import { z } from 'zod';

export const envSchema = z.object({
  // app
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']),
  API_GW_BASE_URL: z.string().url(),
  BILLING_SERVICE_HOST: z.string().min(1),
  BILLING_SERVICE_PORT: z.coerce.number().int().positive(),
  BILLING_SERVICE_HTTP_PORT: z.coerce.number().int().positive(),
  SERVICE_NAME: z.string().default('billing-service'),

  // redis
  REDIS_HOST: z.string().min(1, 'REDIS_HOST cannot be empty'),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().nonnegative().optional(),
  REDIS_KEY_PREFIX: z.string().optional().default('cache:'),
  CACHE_TTL_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(300000), // 5 minutes

  // RabbitMQ
  RMQ_HOST: z.string().min(1),
  RMQ_PORT: z.coerce.number().int().positive(),
  RMQ_USER: z.string().min(1),
  RMQ_PASS: z.string().min(1),
  NOTIFICATION_QUEUE_NAME: z.string().min(1),

  // Database
  DATABASE_URL: z
    .string()
    .url({ message: 'DATABASE_URL must be a valid URL' })
    .refine((url) => url.startsWith('postgres://'), {
      message: 'DATABASE_URL must start with "postgres://"',
    }),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive(),
  DB_POOL_TIMEOUT: z.coerce.number().int().positive(),
  DB_CONNECT_TIMEOUT: z.coerce.number().int().positive(),

  // GP
  GP_BASE_URL: z.string().url(),
  GP_BASIC_AUTH_USER: z.string().min(1, 'User is required'),
  GP_BASIC_AUTH_PASS: z.string().min(1, 'Password is required'),

  // log
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .optional()
    .default('info'),
});

export type EnvVars = z.infer<typeof envSchema>;
