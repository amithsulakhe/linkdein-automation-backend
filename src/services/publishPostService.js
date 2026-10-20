import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { publishPost } from '../integrations/linkedin/linkedinService.js';
import { sendPostPublishedEmail } from '../integrations/gmail/gmailService.js';
import { generateIdempotencyKey } from '../utils/crypto.js';
import { logger } from '../config/logger.js';
import { recordAudit } from './auditService.js';
import { ApiError } from '../utils/apiError.js';

export async function publishApprovedPost(postId) {
  const claimed = await Post.findOneAndUpdate(
    { _id: postId, status: { $in: ['APPROVED', 'PUBLISH_FAILED'] } },
    { $set: { status: 'PUBLISHING', lastPublishingError: undefined } },
    { new: true }
  );
  if (!claimed) {
    const current = await Post.findById(postId);
    if (!current) throw new ApiError(404, 'Post not found');
    if (current.status === 'PUBLISHED') return { skipped: true, status: 'PUBLISHED' };
    throw new ApiError(409, `Cannot publish post in status ${current.status}`);
  }

  const idempotencyKey = claimed.publishIdempotencyKey || generateIdempotencyKey(String(claimed._id), claimed.contentHash);
  claimed.publishIdempotencyKey = idempotencyKey;
  await claimed.save();

  try {
    const result = await publishPost(claimed.userId, claimed);
    claimed.status = 'PUBLISHED';
    claimed.linkedInPostId = result.linkedInPostId;
    claimed.publishedUrl = result.publishedUrl;
    claimed.publishedAt = new Date();
    claimed.lastPublishingError = undefined;
    await claimed.save();

    await recordAudit({
      userId: claimed.userId,
      action: 'post.published',
      resourceType: 'Post',
      resourceId: claimed._id,
      previousState: 'APPROVED',
      newState: 'PUBLISHED',
    });

    const user = await User.findById(claimed.userId);
    if (user?.preferences?.emailNotifications !== false) {
      try {
        await sendPostPublishedEmail({
          userId: claimed.userId,
          toEmail: user.email,
          topic: claimed.topic,
          postContent: claimed.content,
          publishedUrl: result.publishedUrl,
        });
      } catch (mailErr) {
        logger.warn({ err: mailErr.message, postId }, 'Published notification email failed');
      }
    }
    return { status: 'PUBLISHED', ...result };
  } catch (err) {
    claimed.status = 'PUBLISH_FAILED';
    claimed.lastPublishingError = err.message;
    await claimed.save();
    logger.error({ err, postId }, 'Publish failed');
    throw err;
  }
}

export async function publishStuckApprovedPosts() {
  const stuck = await Post.find({ status: { $in: ['APPROVED', 'PUBLISHING'] } }).select('_id topic status');
  for (const post of stuck) {
    if (post.status === 'PUBLISHING') {
      await Post.updateOne({ _id: post._id, status: 'PUBLISHING' }, { status: 'APPROVED' });
    }
    try {
      await publishApprovedPost(post._id);
      logger.info({ postId: post._id, topic: post.topic }, 'Published approved post');
    } catch (err) {
      logger.error({ err: err.message, postId: post._id }, 'Could not publish approved post');
    }
  }
}
