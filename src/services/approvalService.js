import mongoose from 'mongoose';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { Post } from '../models/Post.js';
import { env } from '../config/env.js';
import { generateSecureToken, hashToken, hashContent } from '../utils/crypto.js';
import { ApiError } from '../utils/apiError.js';
import { recordAudit } from './auditService.js';
import { sendApprovalEmail } from '../integrations/gmail/gmailService.js';
import { User } from '../models/User.js';
import fs from 'fs/promises';
import { getPostImagePath } from './postMediaService.js';

export async function createApprovalRequestForPost(userId, postId, req) {
  const post = await Post.findOne({ _id: postId, userId });
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }
  if (!['DRAFT', 'PENDING_APPROVAL'].includes(post.status)) {
    throw new ApiError(400, 'Post cannot enter approval from current status');
  }

  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.APPROVAL_EXPIRY_HOURS * 60 * 60 * 1000);

  const approval = await ApprovalRequest.create({
    userId,
    postId: post._id,
    contentHash: post.contentHash,
    tokenHash,
    status: 'PENDING',
    expiresAt,
  });

  post.status = 'PENDING_APPROVAL';
  post.approvalRequestId = approval._id;
  await post.save();

  await recordAudit({
    userId,
    action: 'approval.created',
    resourceType: 'ApprovalRequest',
    resourceId: approval._id,
    previousState: 'DRAFT',
    newState: 'PENDING_APPROVAL',
    req,
  });

  return { approval, rawToken };
}

export async function sendApprovalEmailForRequest(userId, approvalId, userEmail, rawToken) {
  const approval = await ApprovalRequest.findOne({ _id: approvalId, userId }).populate('postId');
  if (!approval) {
    throw new ApiError(404, 'Approval not found');
  }
  const post = approval.postId;
  const reviewBase = `${env.FRONTEND_URL}/approvals/review?token=${encodeURIComponent(rawToken)}`;
  const approveUrl = `${reviewBase}&intent=approve`;
  const rejectUrl = `${reviewBase}&intent=reject`;
  const isScheduled = post.generationSource === 'scheduled';
  const subjectPrefix = isScheduled ? '[Scheduled — action required]' : '[Action required]';
  const user = await User.findById(userId).select('timezone');
  let imageBuffer = null;
  if (post.imageStorageKey) {
    try {
      imageBuffer = await fs.readFile(getPostImagePath(post.imageStorageKey));
    } catch {
      imageBuffer = null;
    }
  }

  try {
    const result = await sendApprovalEmail({
      userId,
      toEmail: userEmail,
      postContent: post.content,
      topic: post.topic,
      generationDate: post.createdAt,
      approveUrl,
      rejectUrl,
      dashboardUrl: `${env.FRONTEND_URL}/approval-queue`,
      expiresAt: approval.expiresAt,
      hasImage: Boolean(imageBuffer),
      imageBuffer,
      imageMimeType: post.imageMimeType,
      timeZone: user?.timezone || 'Asia/Kolkata',
      subjectPrefix,
      introLine: isScheduled
        ? 'Your scheduled AI run created this draft. Approve or reject below — nothing publishes until you confirm on the review page.'
        : 'Opening a link alone does not publish. You must confirm on the secure page.',
    });
    approval.emailMessageId = result.messageId;
    approval.emailDeliveryStatus = 'sent';
    await approval.save();
    return result;
  } catch (err) {
    approval.emailDeliveryStatus = 'failed';
    approval.emailDeliveryError = err.message;
    await approval.save();
    throw err;
  }
}

export async function getApprovalByToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const approval = await ApprovalRequest.findOne({ tokenHash }).populate('postId');
  if (!approval) {
    throw new ApiError(404, 'Approval request not found');
  }
  return approval;
}

export async function confirmApproval({
  rawToken,
  userId,
  decision,
  decisionSource,
  req,
}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tokenHash = hashToken(rawToken);
    const approval = await ApprovalRequest.findOne({ tokenHash }).session(session);
    if (!approval) {
      throw new ApiError(404, 'Approval not found');
    }
    if (approval.userId.toString() !== userId.toString()) {
      throw new ApiError(403, 'Not authorized');
    }
    if (approval.status !== 'PENDING') {
      throw new ApiError(409, `Approval already ${approval.status.toLowerCase()}`);
    }
    if (approval.expiresAt < new Date()) {
      approval.status = 'EXPIRED';
      await approval.save({ session });
      const post = await Post.findById(approval.postId).session(session);
      if (post && post.status === 'PENDING_APPROVAL') {
        post.status = 'EXPIRED';
        await post.save({ session });
      }
      throw new ApiError(410, 'Approval request expired');
    }

    const post = await Post.findById(approval.postId).session(session);
    if (!post) {
      throw new ApiError(404, 'Post not found');
    }
    if (post.contentHash !== approval.contentHash) {
      throw new ApiError(409, 'Post content changed — new approval required');
    }

    if (decision === 'approve') {
      approval.status = 'APPROVED';
      approval.decidedAt = new Date();
      approval.decisionSource = decisionSource;
      post.status = 'APPROVED';
      await approval.save({ session });
      await post.save({ session });
      await session.commitTransaction();

      await recordAudit({
        userId,
        action: 'approval.approved',
        resourceType: 'ApprovalRequest',
        resourceId: approval._id,
        previousState: 'PENDING',
        newState: 'APPROVED',
        req,
      });

      const { publishApprovedPost } = await import('./publishPostService.js');
      const published = await publishApprovedPost(post._id);
      return { status: published.status || 'PUBLISHED', postId: post._id, publishedUrl: published.publishedUrl };
    }

    approval.status = 'REJECTED';
    approval.decidedAt = new Date();
    approval.decisionSource = decisionSource;
    post.status = 'REJECTED';
    await approval.save({ session });
    await post.save({ session });
    await session.commitTransaction();

    await recordAudit({
      userId,
      action: 'approval.rejected',
      resourceType: 'ApprovalRequest',
      resourceId: approval._id,
      previousState: 'PENDING',
      newState: 'REJECTED',
      req,
    });
    return { status: 'REJECTED', postId: post._id };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export function invalidateApprovalOnEdit(post) {
  if (post.status === 'APPROVED' || post.status === 'PENDING_APPROVAL') {
    post.status = 'DRAFT';
    post.approvalRequestId = undefined;
  }
}
