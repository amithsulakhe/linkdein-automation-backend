import crypto from 'crypto';
import { env } from '../config/env.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { tickScheduledPosts } from '../jobs/dailyGenerationCron.js';

function secretMatches(provided) {
  const expected = env.CRON_SECRET || '';
  const left = Buffer.from(provided || '');
  const right = Buffer.from(expected);
  if (!expected || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export const runScheduledPosts = asyncHandler(async (req, res) => {
  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!secretMatches(provided)) throw new ApiError(401, 'Unauthorized');
  await tickScheduledPosts();
  res.json({ success: true });
});
