import mongoose from 'mongoose';

const aiUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', index: true },
    purpose: {
      type: String,
      enum: ['scheduled_post', 'compose_generate', 'insights', 'chat', 'embedding', 'image_generate'],
      required: true,
    },
    model: { type: String, required: true },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
  },
  { timestamps: true }
);

aiUsageSchema.index({ userId: 1, createdAt: -1 });

export const AiUsage = mongoose.model('AiUsage', aiUsageSchema);
