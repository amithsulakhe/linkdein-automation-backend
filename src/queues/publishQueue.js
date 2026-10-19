import { Queue } from 'bullmq';
import { getRedisConnection } from './connection.js';

export const publishQueue = new Queue('publish', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export async function enqueuePublishJob(post) {
  const postId = post._id.toString();
  const userId = post.userId.toString();
  await publishQueue.add(
    'publish-post',
    { postId, userId, contentHash: post.contentHash },
    { jobId: `publish-${postId}-${post.contentHash}-${Date.now()}` }
  );
}
