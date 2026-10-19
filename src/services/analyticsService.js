import { Post } from '../models/Post.js';
import { PostAnalytics } from '../models/PostAnalytics.js';
import { syncPostMetrics } from '../integrations/linkedin/linkedinService.js';

/**
 * Engagement rate = (reactions + comments + shares) / impressions when impressions > 0.
 */
export function computeEngagementRate({ impressions, reactions, comments, shares }) {
  if (impressions == null || impressions <= 0) return null;
  const engagement = (reactions || 0) + (comments || 0) + (shares || 0);
  return Number(((engagement / impressions) * 100).toFixed(2));
}

export async function getAnalyticsOverview(userId) {
  const publishedCount = await Post.countDocuments({ userId, status: 'PUBLISHED' });
  const pendingApprovals = await Post.countDocuments({ userId, status: 'PENDING_APPROVAL' });
  const rejectedPosts = await Post.countDocuments({ userId, status: 'REJECTED' });

  const analytics = await PostAnalytics.find({ userId }).lean();
  const withMetrics = analytics.filter((a) => a.metricsSource === 'linkedin_api');

  const totals = withMetrics.reduce(
    (acc, a) => {
      acc.impressions += a.impressions || 0;
      acc.reactions += a.reactions || 0;
      acc.comments += a.comments || 0;
      acc.shares += a.shares || 0;
      return acc;
    },
    { impressions: 0, reactions: 0, comments: 0, shares: 0 }
  );

  const avgEngagement = computeEngagementRate(totals);

  const recentActivity = await Post.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(10)
    .select('topic status content publishedAt updatedAt publishedUrl')
    .lean();

  const topPosts = await PostAnalytics.find({ userId, metricsSource: 'linkedin_api' })
    .sort({ reactions: -1 })
    .limit(5)
    .populate('postId', 'topic content publishedUrl')
    .lean();

  return {
    publishedCount,
    pendingApprovals,
    rejectedPosts,
    metricsAvailability:
      withMetrics.length > 0
        ? 'partial_or_full'
        : 'unavailable — sync LinkedIn analytics after connecting and verifying API product access',
    totals,
    averageEngagementRate: avgEngagement,
    engagementRateDefinition:
      '(reactions + comments + shares) / impressions × 100, using LinkedIn API metrics when available',
    recentActivity,
    topPosts,
  };
}

export async function syncAnalyticsForUser(userId) {
  const posts = await Post.find({ userId, status: 'PUBLISHED', linkedInPostId: { $exists: true } });
  const results = [];
  for (const post of posts) {
    const synced = await syncPostMetrics(userId, post.linkedInPostId);
    if (synced.metricsSource === 'linkedin_api') {
      const raw = synced.rawMetrics;
      await PostAnalytics.findOneAndUpdate(
        { userId, postId: post._id },
        {
          userId,
          postId: post._id,
          linkedInPostId: post.linkedInPostId,
          metricsSource: 'linkedin_api',
          rawMetrics: raw,
          retrievedAt: new Date(),
        },
        { upsert: true }
      );
    } else {
      await PostAnalytics.findOneAndUpdate(
        { userId, postId: post._id },
        {
          userId,
          postId: post._id,
          linkedInPostId: post.linkedInPostId,
          metricsSource: 'unavailable',
          rawMetrics: synced,
          retrievedAt: new Date(),
        },
        { upsert: true }
      );
    }
    results.push({ postId: post._id, ...synced });
  }
  return results;
}

export async function getPostsAnalyticsTable(userId, { skip, limit, search, status, sort }) {
  const filter = { userId };
  if (status) filter.status = status;
  if (search) {
    filter.$or = [{ content: new RegExp(search, 'i') }, { topic: new RegExp(search, 'i') }];
  }
  const sortField = sort?.field || 'createdAt';
  const sortDir = sort?.dir === 'asc' ? 1 : -1;

  const [posts, total] = await Promise.all([
    Post.find(filter).sort({ [sortField]: sortDir }).skip(skip).limit(limit).lean(),
    Post.countDocuments(filter),
  ]);

  const analyticsMap = {};
  const analytics = await PostAnalytics.find({ userId, postId: { $in: posts.map((p) => p._id) } }).lean();
  for (const a of analytics) {
    analyticsMap[a.postId.toString()] = a;
  }

  const items = posts.map((post) => {
    const a = analyticsMap[post._id.toString()];
    return {
      ...post,
      analytics: a
        ? {
            impressions: a.impressions,
            reactions: a.reactions,
            comments: a.comments,
            shares: a.shares,
            metricsSource: a.metricsSource,
            engagementRate: computeEngagementRate(a),
          }
        : { metricsSource: 'unavailable' },
    };
  });

  return { items, total };
}

export async function getTimeseries(userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const posts = await Post.find({
    userId,
    status: 'PUBLISHED',
    publishedAt: { $gte: since },
  })
    .select('publishedAt topic')
    .lean();

  const analytics = await PostAnalytics.find({ userId }).lean();
  const byDay = {};
  for (const post of posts) {
    const day = post.publishedAt?.toISOString().slice(0, 10);
    if (!day) continue;
    byDay[day] = byDay[day] || { date: day, posts: 0, reactions: 0, impressions: 0 };
    byDay[day].posts += 1;
    const a = analytics.find((x) => x.postId.toString() === post._id.toString());
    if (a?.metricsSource === 'linkedin_api') {
      byDay[day].reactions += a.reactions || 0;
      byDay[day].impressions += a.impressions || 0;
    }
  }
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}
