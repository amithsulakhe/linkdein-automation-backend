import { z } from 'zod';
import { asyncHandler } from '../utils/apiError.js';
import { ScheduledJob } from '../models/ScheduledJob.js';
import { env } from '../config/env.js';
import { resetUserOperationalData } from '../services/resetUserDataService.js';
import {
  getUserScheduledPostTimes,
  formatSlotLabel,
  slotIdFromTime,
  getNextScheduledRunForUser,
  normalizeSlot,
} from '../utils/userSchedule.js';

const slotSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

export const getSettings = asyncHandler(async (req, res) => {
  if (req.user.preferences?.autoPublishScheduledPosts) {
    req.user.preferences.autoPublishScheduledPosts = false;
    req.user.markModified('preferences');
    await req.user.save();
  }
  const times = getUserScheduledPostTimes(req.user);
  res.json({
    success: true,
    data: {
      timezone: req.user.timezone,
      preferences: req.user.preferences,
      scheduledPostTimes: times.map((t) => ({
        ...t,
        slotId: slotIdFromTime(t.hour, t.minute),
        label: formatSlotLabel(t.hour, t.minute),
      })),
      nextScheduledRun: getNextScheduledRunForUser(req.user),
      appTimezone: env.APP_TIMEZONE,
    },
  });
});

export const patchSettings = asyncHandler(async (req, res) => {
  const schema = z.object({
    timezone: z.string().optional(),
    preferences: z
      .object({
        dailyGenerationEnabled: z.boolean().optional(),
        emailNotifications: z.boolean().optional(),
        contentType: z.string().min(1).max(40).optional(),
        contentBrief: z.string().max(1000).optional(),
        defaultTopics: z.array(z.string()).optional(),
        scheduledPostTimes: z.array(slotSchema).min(1).max(24).optional(),
      })
      .optional(),
  });
  const body = schema.parse(req.body);
  if (body.timezone) req.user.timezone = body.timezone;
  if (body.preferences) {
    const merged = {
      ...(req.user.preferences?.toObject?.() ?? req.user.preferences ?? {}),
      ...body.preferences,
    };
    if (body.preferences.scheduledPostTimes) {
      const seen = new Set();
      merged.scheduledPostTimes = body.preferences.scheduledPostTimes
        .map(normalizeSlot)
        .filter((s) => {
          if (!s) return false;
          const key = `${s.hour}:${s.minute}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }
    merged.autoPublishScheduledPosts = false;
    req.user.preferences = merged;
    req.user.markModified('preferences');
  }
  await req.user.save();
  const times = getUserScheduledPostTimes(req.user);
  res.json({
    success: true,
    data: {
      timezone: req.user.timezone,
      preferences: req.user.preferences,
      scheduledPostTimes: times.map((t) => ({
        ...t,
        label: formatSlotLabel(t.hour, t.minute),
      })),
    },
  });
});

export const jobsStatus = asyncHandler(async (req, res) => {
  const jobs = await ScheduledJob.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ success: true, data: jobs });
});

const resetSchema = z.object({ confirm: z.literal('DELETE_ALL') });

export const resetUserData = asyncHandler(async (req, res) => {
  resetSchema.parse(req.body);
  await resetUserOperationalData(req.user._id);
  const topics = req.user.preferences?.defaultTopics;
  req.user.preferences = {
    dailyGenerationEnabled: true,
    emailNotifications: true,
    autoPublishScheduledPosts: false,
    scheduledPostTimes: [
      { hour: 10, minute: 0 },
      { hour: 14, minute: 0 },
    ],
    ...(topics?.length ? { defaultTopics: topics } : {}),
  };
  req.user.markModified('preferences');
  await req.user.save();
  res.json({ success: true, message: 'All posts, documents, chat, jobs, and integrations cleared for this account.' });
});
