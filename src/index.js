console.log('API process started, loading app…');

import app from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startPublishWorker } from './workers/publishWorker.js';
import { startIngestionWorker } from './workers/ingestionWorker.js';
import { startDailyGenerationCron } from './jobs/dailyGenerationCron.js';
import { closeRedis, getRedisConnection } from './queues/connection.js';
import { publishStuckApprovedPosts } from './services/publishPostService.js';
import { resumeStuckDocuments } from './services/documentService.js';

let server;
let publishWorker;
let ingestionWorker;

async function start() {
  logger.info('Connecting to MongoDB…');
  await connectDb();
  try {
    const redis = getRedisConnection();
    await Promise.race([
      redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping timeout')), 3000)),
    ]);
    publishWorker = startPublishWorker();
    ingestionWorker = startIngestionWorker();
    logger.info('Redis connected — background workers started');
  } catch (err) {
    logger.warn(
      { err: err.message },
      'Redis unavailable — set REDIS_URL in server/.env before publishing approved posts'
    );
  }
  startDailyGenerationCron();

  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Server listening');
    publishStuckApprovedPosts().catch((err) => {
      logger.error({ err: err.message }, 'Startup publish of approved posts failed');
    });
    resumeStuckDocuments().catch((err) => {
      logger.error({ err: err.message }, 'Resume document processing failed');
    });
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        { port: env.PORT },
        'Port already in use. Stop the other server (or close old terminals) and restart.'
      );
      process.exit(1);
    }
    throw err;
  });
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (publishWorker) await publishWorker.close();
  if (ingestionWorker) await ingestionWorker.close();
  await closeRedis();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
