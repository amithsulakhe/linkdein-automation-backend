import mongoose from 'mongoose';

export const POST_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'EXPIRED',
  'PUBLISHING',
  'PUBLISH_FAILED',
  'GENERATION_FAILED',
];

const postSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topic: { type: String, required: true },
    content: { type: String, required: true },
    contentHash: { type: String, required: true, index: true },
    hashtags: [{ type: String }],
    status: { type: String, enum: POST_STATUSES, default: 'DRAFT', index: true },
    generationSource: { type: String, enum: ['scheduled', 'manual', 'chatbot_draft'], default: 'manual' },
    scheduledGenerationTime: { type: Date },
    approvalRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRequest' },
    linkedInPostId: { type: String },
    publishedUrl: { type: String },
    publishedAt: { type: Date },
    lastPublishingError: { type: String },
    publishIdempotencyKey: { type: String, unique: true, sparse: true },
    imageStorageKey: { type: String },
    imageOriginalName: { type: String },
    imageMimeType: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    aiModel: { type: String },
    aiPromptTokens: { type: Number, default: 0 },
    aiCompletionTokens: { type: Number, default: 0 },
    aiCostUsd: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ userId: 1, status: 1, createdAt: -1 });
postSchema.index({ userId: 1, publishedAt: -1 });

export const Post = mongoose.model('Post', postSchema);
