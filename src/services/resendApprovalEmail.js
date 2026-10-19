import { Post } from '../models/Post.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { ApiError } from '../utils/apiError.js';
import {
  createApprovalRequestForPost,
  sendApprovalEmailForRequest,
} from './approvalService.js';

export async function resendApprovalEmailForPost(userId, postId, userEmail, req) {
  const post = await Post.findOne({ _id: postId, userId });
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }
  if (post.status !== 'PENDING_APPROVAL' && post.status !== 'DRAFT') {
    throw new ApiError(400, 'Post is not waiting for approval email');
  }

  if (post.approvalRequestId) {
    await ApprovalRequest.updateMany(
      { postId: post._id, status: 'PENDING' },
      { status: 'SUPERSEDED' }
    );
    if (post.status === 'PENDING_APPROVAL') {
      post.status = 'DRAFT';
      post.approvalRequestId = undefined;
      await post.save();
    }
  }

  const { approval, rawToken } = await createApprovalRequestForPost(userId, postId, req);
  await sendApprovalEmailForRequest(userId, approval._id, userEmail, rawToken);
  return { approvalId: approval._id };
}
