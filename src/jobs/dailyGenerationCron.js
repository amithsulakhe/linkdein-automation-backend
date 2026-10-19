import cron from 'node-cron';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ScheduledJob } from '../models/ScheduledJob.js';
import { runDailyPostWorkflow } from '../agents/graphs/dailyPostGraph.js';
import { logger } from '../config/logger.js';
import {
  getMatchingSlotsForUserNow,
  slotIdFromTime,
  getNextScheduledRunForUser,
  slotIdToLabel,
} from '../utils/userSchedule.js';

export { slotIdToLabel, slotIdFromTime as cronExpressionToSlotId };

function todayKeyInTimezone(timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function runScheduledGenerationForUser(user, slotId) {
  const tz = user.timezone || env.APP_TIMEZONE;
  const jobDateKey = todayKeyInTimezone(tz);
  const jobKey = `scheduled-post:${user._id}:${jobDateKey}:${slotId}`;

  const existing = await ScheduledJob.findOne({ jobKey });
  if (existing && ['running', 'completed'].includes(existing.status)) {
    logger.info({ jobKey }, 'Skipping duplicate scheduled generation');
    return;
  }

  await ScheduledJob.findOneAndUpdate(
    { jobKey },
    {
      jobKey,
      userId: user._id,
      jobType: 'scheduled_post_generation',
      status: 'running',
      startedAt: new Date(),
      metadata: { slotId, jobDateKey },
    },
    { upsert: true, new: true }
  );

  try {
    await runDailyPostWorkflow(user._id, jobDateKey, slotId);
    await ScheduledJob.updateOne(
      { jobKey },
      { status: 'completed', completedAt: new Date(), error: null }
    );
  } catch (err) {
    logger.error({ err, userId: user._id, slotId }, 'Scheduled generation failed');
    await ScheduledJob.updateOne(
      { jobKey },
      { status: 'failed', completedAt: new Date(), error: err.message, $inc: { retryCount: 1 } }
    );
  }
}

async function tickScheduledPosts() {
  const users = await User.find({
    accountStatus: 'active',
    'preferences.dailyGenerationEnabled': { $ne: false },
  });
  for (const user of users) {
    const slots = getMatchingSlotsForUserNow(user);
    for (const slot of slots) {
      const slotId = slotIdFromTime(slot.hour, slot.minute);
      await runScheduledGenerationForUser(user, slotId);
    }
  }
}

export function startDailyGenerationCron() {
  cron.schedule('* * * * *', () => {
    tickScheduledPosts().catch((err) => logger.error({ err }, 'Scheduled post tick failed'));
  });
  logger.info({ tz: env.APP_TIMEZONE }, 'Scheduled post checker running every minute (per-user times in Settings)');
}

export function getNextScheduledRun(user) {
  if (user) return getNextScheduledRunForUser(user);
  return getNextScheduledRunForUser({ timezone: env.APP_TIMEZONE, preferences: {} });
}
