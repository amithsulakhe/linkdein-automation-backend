import mongoose from 'mongoose';

const scheduledJobSchema = new mongoose.Schema(
  {
    jobKey: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    jobType: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String },
    retryCount: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const ScheduledJob = mongoose.model('ScheduledJob', scheduledJobSchema);
