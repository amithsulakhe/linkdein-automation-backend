import { Worker } from 'bullmq';
import { getRedisConnection } from '../queues/connection.js';
import { processDocument } from '../services/documentIngestion.js';
import { logger } from '../config/logger.js';

export function startIngestionWorker() {
  const worker = new Worker(
    'document-ingestion',
    async (job) => processDocument(job.data.documentId, job.data.userId),
    { connection: getRedisConnection(), concurrency: 2 }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err?.message }, 'Document ingestion job failed');
  });
  return worker;
}
