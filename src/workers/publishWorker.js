import { Worker } from 'bullmq';
import { getRedisConnection } from '../queues/connection.js';
import { publishApprovedPost } from '../services/publishPostService.js';
import { logger } from '../config/logger.js';

export function startPublishWorker() {
  const worker = new Worker(
    'publish',
    async (job) => publishApprovedPost(job.data.postId),
    { connection: getRedisConnection(), concurrency: 2 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err?.message }, 'Publish job failed');
  });

  return worker;
}
