import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    previousState: { type: String },
    newState: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
