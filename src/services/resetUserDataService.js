import { Post } from '../models/Post.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { PostAnalytics } from '../models/PostAnalytics.js';
import { Document } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { ChatConversation } from '../models/ChatConversation.js';
import { ScheduledJob } from '../models/ScheduledJob.js';
import { AuditLog } from '../models/AuditLog.js';
import { OAuthConnection } from '../models/OAuthConnection.js';

export async function resetUserOperationalData(userId) {
  const id = userId.toString();
  await Promise.all([
    Post.deleteMany({ userId }),
    ApprovalRequest.deleteMany({ userId }),
    PostAnalytics.deleteMany({ userId }),
    Document.deleteMany({ userId }),
    DocumentChunk.deleteMany({ userId }),
    ChatConversation.deleteMany({ userId }),
    ScheduledJob.deleteMany({ userId }),
    AuditLog.deleteMany({ userId }),
    OAuthConnection.deleteMany({ userId }),
  ]);
  return { userId: id };
}
