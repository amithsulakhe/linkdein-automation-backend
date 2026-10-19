import mongoose from 'mongoose';

const postAnalyticsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    linkedInPostId: { type: String },
    impressions: { type: Number },
    reactions: { type: Number },
    comments: { type: Number },
    shares: { type: Number },
    metricsSource: {
      type: String,
      enum: ['linkedin_api', 'unavailable', 'partial'],
      default: 'unavailable',
    },
    rawMetrics: { type: mongoose.Schema.Types.Mixed },
    retrievedAt: { type: Date },
  },
  { timestamps: true }
);

postAnalyticsSchema.index({ userId: 1, postId: 1 }, { unique: true });

export const PostAnalytics = mongoose.model('PostAnalytics', postAnalyticsSchema);
