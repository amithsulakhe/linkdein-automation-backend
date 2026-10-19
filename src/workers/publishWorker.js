import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { getRedisConnection } from '../queues/connection.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { publishPost } from '../integrations/linkedin/linkedinService.js';
import { sendPostPublishedEmail } from '../integrations/gmail/gmailService.js';
import { generateIdempotencyKey } from '../utils/crypto.js';
import { logger } from '../config/logger.js';
import { recordAudit } from '../services/auditService.js';

export function startPublishWorker() {
  const worker = new Worker(
    'publish',
    async (job) => {
      const { postId, userId, contentHash } = job.data;
      const post = await Post.findOne({ _id: postId, userId });
      if (!post) {
        throw new Error('Post not found');
      }
      if (post.status === 'PUBLISHED') {
        return { skipped: true, reason: 'already published' };
      }
      if (post.status === 'PUBLISH_FAILED') {
        post.status = 'APPROVED';
        await post.save();
      }
      if (post.status !== 'APPROVED') {
        throw new Error(`Cannot publish post in status ${post.status}`);
      }
      if (post.contentHash !== contentHash) {
        post.status = 'DRAFT';
        await post.save();
        throw new Error('Content hash mismatch — approval invalidated');
      }

      const idempotencyKey = post.publishIdempotencyKey || generateIdempotencyKey(postId, contentHash);
      post.publishIdempotencyKey = idempotencyKey;
      await post.save();

      try {
        const result = await publishPost(userId, post);
        post.status = 'PUBLISHED';
        post.linkedInPostId = result.linkedInPostId;
        post.publishedUrl = result.publishedUrl;
        post.publishedAt = new Date();
        post.lastPublishingError = undefined;
        await post.save();

        await recordAudit({
          userId,
          action: 'post.published',
          resourceType: 'Post',
          resourceId: post._id,
          previousState: 'APPROVED',
          newState: 'PUBLISHED',
        });

        const user = await User.findById(userId);
        if (user?.preferences?.emailNotifications !== false) {
          try {
            await sendPostPublishedEmail({
              userId,
              toEmail: user.email,
              topic: post.topic,
              postContent: post.content,
              publishedUrl: result.publishedUrl,
            });
          } catch (mailErr) {
            logger.warn({ err: mailErr.message, postId }, 'Published notification email failed');
          }
        }
        return result;
      } catch (err) {
        post.status = 'PUBLISH_FAILED';
        post.lastPublishingError = err.message;
        await post.save();
        logger.error({ err, postId }, 'Publish failed');
        throw err;
      }
    },
    { connection: getRedisConnection(), concurrency: 2 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Publish job failed');
  });

  return worker;
}
