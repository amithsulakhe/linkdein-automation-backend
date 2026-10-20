import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let redis = null;

export function getRedisConnection() {
  if (!redis) {
    redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 8000,
      retryStrategy(times) {
        if (times > 4) return null;
        return Math.min(times * 300, 2000);
      },
    });
    redis.on('error', (err) => {
      if (err?.code === 'ECONNREFUSED') {
        logger.debug('Redis not running (optional until publish/ingestion jobs)');
        return;
      }
      logger.error({ err }, 'Redis error');
    });
  }
  return redis;
}

export async function closeRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
