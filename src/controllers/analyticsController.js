import { z } from 'zod';
import { asyncHandler } from '../utils/apiError.js';
import { parsePagination, paginatedResponse } from '../utils/pagination.js';
import {
  getAnalyticsOverview,
  getPostsAnalyticsTable,
  getTimeseries,
  syncAnalyticsForUser,
} from '../services/analyticsService.js';
import { getNextScheduledRun } from '../jobs/dailyGenerationCron.js';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { recordAiUsage, summarizeAiUsage } from '../services/aiUsageService.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const overview = asyncHandler(async (req, res) => {
  const data = await getAnalyticsOverview(req.user._id);
  const nextScheduledGeneration = getNextScheduledRun(req.user);
  let aiInsights = null;
  try {
    const nextRunLabel = nextScheduledGeneration
      ? new Date(nextScheduledGeneration).toLocaleString('en-IN', { timeZone: req.user.timezone || 'Asia/Kolkata' })
      : null;
    const brief = {
      published: data.publishedCount,
      pendingApproval: data.pendingApprovals,
      rejected: data.rejectedPosts,
      linkedInMetricsSynced: data.metricsAvailability !== 'unavailable — sync LinkedIn analytics after connecting and verifying API product access',
      impressions: data.totals?.impressions ?? 0,
      reactions: data.totals?.reactions ?? 0,
      nextRun: nextRunLabel,
      recent: (data.recentActivity || []).slice(0, 3).map((post) => ({
        topic: post.topic,
        status: post.status,
      })),
    };
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Write a dashboard note in 2 or 3 short sentences. Plain text only: no markdown, no asterisks, no bullets, no headings, no ISO timestamps. Mention only what is notable. Do not repeat every zero. Do not invent numbers.',
        },
        { role: 'user', content: JSON.stringify(brief) },
      ],
      max_tokens: 180,
    });
    aiInsights = completion.choices[0]?.message?.content?.replace(/\*\*/g, '').trim();
    await recordAiUsage({
      userId: req.user._id,
      purpose: 'insights',
      model: env.OPENAI_CHAT_MODEL,
      usage: completion.usage,
    });
  } catch {
    aiInsights = 'AI insights unavailable — check OpenAI configuration.';
  }
  const aiUsage = await summarizeAiUsage(req.user._id);
  res.json({
    success: true,
    data: { ...data, nextScheduledGeneration, aiInsights, aiUsage },
  });
});

export const usageSummary = asyncHandler(async (req, res) => {
  const data = await summarizeAiUsage(req.user._id);
  res.json({ success: true, data });
});

export const postsAnalytics = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { items, total } = await getPostsAnalyticsTable(req.user._id, {
    skip,
    limit,
    search: req.query.search,
    status: req.query.status,
    sort: { field: req.query.sortField, dir: req.query.sortDir },
  });
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

export const timeseries = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const data = await getTimeseries(req.user._id, days);
  res.json({ success: true, data });
});

export const syncAnalytics = asyncHandler(async (req, res) => {
  const results = await syncAnalyticsForUser(req.user._id);
  res.json({ success: true, data: results });
});
