import { z } from 'zod';
import { Post } from '../models/Post.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { parsePagination, paginatedResponse } from '../utils/pagination.js';
import { computePostContentHash } from '../services/postContentHash.js';
import { savePostImage, getPostImagePath } from '../services/postMediaService.js';
import fs from 'fs';
import {
  createApprovalRequestForPost,
  sendApprovalEmailForRequest,
  getApprovalByToken,
  confirmApproval,
  invalidateApprovalOnEdit,
} from '../services/approvalService.js';
import { resendApprovalEmailForPost } from '../services/resendApprovalEmail.js';
import { recordAudit } from '../services/auditService.js';
import { env } from '../config/env.js';
import OpenAI from 'openai';
import { resolveContentBrief } from '../constants/contentTypes.js';
import { recordAiUsage } from '../services/aiUsageService.js';
import { AiUsage } from '../models/AiUsage.js';
import { toPlainLinkedInText } from '../utils/plainPostText.js';
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const draftSchema = z.object({
  topic: z.string().min(1),
  content: z.string().min(10),
  hashtags: z.array(z.string()).optional(),
});

const patchSchema = z.object({
  topic: z.string().min(1).optional(),
  content: z.string().min(10).optional(),
  hashtags: z.array(z.string()).optional(),
});

export const listPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { userId: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Post.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

export const createDraft = asyncHandler(async (req, res) => {
  const body = draftSchema.parse(req.body);
  const post = await Post.create({
    userId: req.user._id,
    topic: body.topic,
    content: body.content,
    contentHash: computePostContentHash({ topic: body.topic, content: body.content }),
    hashtags: body.hashtags,
    status: 'DRAFT',
    generationSource: 'manual',
  });
  res.status(201).json({ success: true, data: post });
});

export const getPost = asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, userId: req.user._id });
  if (!post) throw new ApiError(404, 'Post not found');
  res.json({ success: true, data: post });
});

export const updatePost = asyncHandler(async (req, res) => {
  const body = patchSchema.parse(req.body);
  const post = await Post.findOne({ _id: req.params.id, userId: req.user._id });
  if (!post) throw new ApiError(404, 'Post not found');
  const prevStatus = post.status;
  if (body.topic) post.topic = body.topic;
  if (body.content) post.content = body.content;
  if (body.hashtags) post.hashtags = body.hashtags;
  invalidateApprovalOnEdit(post);
  post.contentHash = computePostContentHash(post);
  await post.save();
  if (prevStatus === 'APPROVED' && post.status === 'DRAFT') {
    await ApprovalRequest.updateMany(
      { postId: post._id, status: 'PENDING' },
      { status: 'SUPERSEDED' }
    );
    await recordAudit({
      userId: req.user._id,
      action: 'post.edit_invalidated_approval',
      resourceType: 'Post',
      resourceId: post._id,
      previousState: prevStatus,
      newState: post.status,
      req,
    });
  }
  res.json({ success: true, data: post });
});

export const requestApproval = asyncHandler(async (req, res) => {
  const { approval, rawToken } = await createApprovalRequestForPost(
    req.user._id,
    req.params.id,
    req
  );
  try {
    await sendApprovalEmailForRequest(req.user._id, approval._id, req.user.email, rawToken);
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: 'Approval created but email failed',
      data: { approvalId: approval._id },
    });
  }
  res.json({ success: true, data: { approvalId: approval._id } });
});

export const listApprovals = asyncHandler(async (req, res) => {
  const items = await ApprovalRequest.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .populate('postId', 'topic content status')
    .limit(50);
  res.json({ success: true, data: items });
});

export const getApproval = asyncHandler(async (req, res) => {
  const approval = await ApprovalRequest.findOne({ _id: req.params.id, userId: req.user._id }).populate(
    'postId'
  );
  if (!approval) throw new ApiError(404, 'Not found');
  res.json({ success: true, data: approval });
});

export const reviewByToken = asyncHandler(async (req, res) => {
  const token = req.query.token;
  if (!token) throw new ApiError(400, 'Token required');
  const approval = await getApprovalByToken(token);
  if (approval.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }
  res.json({
    success: true,
    data: {
      approvalId: approval._id,
      status: approval.status,
      expiresAt: approval.expiresAt,
      post: approval.postId,
      contentHash: approval.contentHash,
    },
  });
});

export const confirmApprovalAction = asyncHandler(async (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    decision: z.enum(['approve', 'reject']),
  });
  const { token, decision } = schema.parse(req.body);
  const result = await confirmApproval({
    rawToken: token,
    userId: req.user._id,
    decision,
    decisionSource: 'dashboard',
    req,
  });
  res.json({ success: true, data: result });
});

const composeSchema = z.object({
  topic: z.string().min(1).max(200),
  content: z.string().min(10).max(3000),
  usageId: z.string().optional(),
});

export const generateComposeDraft = asyncHandler(async (req, res) => {
  const hint = z.object({ hint: z.string().max(300).optional() }).parse(req.body || {});
  const brief = resolveContentBrief(req.user.preferences);
  const completion = await openai.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Write one LinkedIn post as JSON with keys topic (short) and content. Content must be plain text people can paste on LinkedIn: no markdown, no asterisks, no bold markers. 120-220 words. Stay inside the content type. No fake statistics.',
      },
      {
        role: 'user',
        content: `Content type: ${brief}\nOptional angle: ${hint.hint || 'Pick a fresh practical angle.'}`,
      },
    ],
  });
  const usageDoc = await recordAiUsage({
    userId: req.user._id,
    purpose: 'compose_generate',
    model: env.OPENAI_CHAT_MODEL,
    usage: completion.usage,
  });
  let parsed = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
  } catch {
    parsed = {};
  }
  res.json({
    success: true,
    data: {
      topic: parsed.topic || hint.hint || 'LinkedIn post',
      content: toPlainLinkedInText(parsed.content || ''),
      usageId: usageDoc._id,
      costUsd: usageDoc.costUsd,
      totalTokens: usageDoc.totalTokens,
    },
  });
});

/** Create post (optional image) and send approval email in one step after user confirms in UI. */
export const composeAndSendMail = asyncHandler(async (req, res) => {
  const body = composeSchema.parse({
    topic: req.body.topic,
    content: req.body.content,
    usageId: req.body.usageId || undefined,
  });

  let imageFields = {};
  if (req.file) {
    imageFields = await savePostImage(req.user._id, req.file);
  }
  body.content = toPlainLinkedInText(body.content);

  let aiFields = {};
  if (body.usageId) {
    const usage = await AiUsage.findOne({ _id: body.usageId, userId: req.user._id });
    if (usage) {
      aiFields = {
        aiModel: usage.model,
        aiPromptTokens: usage.promptTokens,
        aiCompletionTokens: usage.completionTokens,
        aiCostUsd: usage.costUsd || 0,
        generationSource: 'manual',
      };
    }
  }

  const post = await Post.create({
    userId: req.user._id,
    topic: body.topic,
    content: body.content,
    ...imageFields,
    ...aiFields,
    contentHash: computePostContentHash({ ...body, ...imageFields }),
    status: 'DRAFT',
    generationSource: 'manual',
  });
  if (body.usageId) {
    await AiUsage.updateOne({ _id: body.usageId, userId: req.user._id }, { postId: post._id });
  }

  const { approval, rawToken } = await createApprovalRequestForPost(req.user._id, post._id, req);
  try {
    await sendApprovalEmailForRequest(req.user._id, approval._id, req.user.email, rawToken);
  } catch (err) {
    const hint =
      err.statusCode === 400
        ? 'Connect Gmail in Settings (same Google account you want to send from), then use Resend on Approval Queue.'
        : 'Check Gmail connection and Google Cloud (Gmail API enabled, OAuth test user added).';
    return res.status(502).json({
      success: false,
      error: `Post saved but approval email failed: ${err.message}. ${hint}`,
      data: { postId: post._id, approvalId: approval._id },
    });
  }

  res.status(201).json({
    success: true,
    data: {
      postId: post._id,
      approvalId: approval._id,
      message: 'Approval email sent. Confirm from the email link to publish — email alone does not publish.',
    },
  });
});

export const retryPublish = asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, userId: req.user._id });
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }
  if (post.status !== 'PUBLISH_FAILED' && post.status !== 'APPROVED') {
    throw new ApiError(409, `Cannot retry publish for status ${post.status}`);
  }
  if (post.status === 'PUBLISH_FAILED') {
    post.status = 'APPROVED';
    post.lastPublishingError = undefined;
    await post.save();
  }
  const { publishApprovedPost } = await import('../services/publishPostService.js');
  const published = await publishApprovedPost(post._id);
  res.json({ success: true, data: { postId: post._id, status: published.status, publishedUrl: published.publishedUrl } });
});

export const resendApprovalEmail = asyncHandler(async (req, res) => {
  const data = await resendApprovalEmailForPost(
    req.user._id,
    req.params.id,
    req.user.email,
    req
  );
  res.json({ success: true, data });
});

export const streamPostImage = asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, userId: req.user._id });
  if (!post?.imageStorageKey) {
    throw new ApiError(404, 'No image for this post');
  }
  const filePath = getPostImagePath(post.imageStorageKey);
  res.setHeader('Content-Type', post.imageMimeType || 'image/jpeg');
  fs.createReadStream(filePath).pipe(res);
});
