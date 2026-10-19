import mongoose from 'mongoose';

export const APPROVAL_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'SUPERSEDED',
];

const approvalRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    contentHash: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: APPROVAL_STATUSES, default: 'PENDING', index: true },
    expiresAt: { type: Date, required: true, index: true },
    decidedAt: { type: Date },
    decisionSource: { type: String, enum: ['email', 'dashboard', null], default: null },
    emailMessageId: { type: String },
    emailDeliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    emailDeliveryError: { type: String },
  },
  { timestamps: true }
);

export const ApprovalRequest = mongoose.model('ApprovalRequest', approvalRequestSchema);
