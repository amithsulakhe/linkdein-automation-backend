import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'accessToken',
      'refreshToken',
      'password',
      'token',
      'OPENAI_API_KEY',
    ],
    remove: true,
  },
});
