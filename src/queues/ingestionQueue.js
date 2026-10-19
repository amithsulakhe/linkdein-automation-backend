import { Queue } from 'bullmq';
import { getRedisConnection } from './connection.js';

export const ingestionQueue = new Queue('document-ingestion', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  },
});
