import { z } from 'zod';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { ChatConversation } from '../models/ChatConversation.js';
import { runChatTurn } from '../agents/tools/chatTools.js';

export const createConversation = asyncHandler(async (req, res) => {
  const conv = await ChatConversation.create({
    userId: req.user._id,
    title: req.body.title || 'New conversation',
    messages: [],
  });
  res.status(201).json({ success: true, data: conv });
});

export const listConversations = asyncHandler(async (req, res) => {
  const items = await ChatConversation.find({ userId: req.user._id })
    .sort({ updatedAt: -1 })
    .select('title updatedAt createdAt')
    .limit(50);
  res.json({ success: true, data: items });
});

export const getMessages = asyncHandler(async (req, res) => {
  const conv = await ChatConversation.findOne({ _id: req.params.id, userId: req.user._id });
  if (!conv) throw new ApiError(404, 'Not found');
  res.json({ success: true, data: conv.messages });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const schema = z.object({
    content: z.string().min(1).max(8000),
    documentId: z.string().optional(),
  });
  const { content, documentId } = schema.parse(req.body);
  const conv = await ChatConversation.findOne({ _id: req.params.id, userId: req.user._id });
  if (!conv) throw new ApiError(404, 'Not found');

  conv.messages.push({ role: 'user', content });
  const result = await runChatTurn(req.user._id, conv.messages, documentId || null);
  conv.messages.push({
    role: 'assistant',
    content: result.content,
    sources: result.sources,
    toolCalls: result.toolResults,
  });
  if (conv.title === 'New conversation') {
    conv.title = content.slice(0, 60);
  }
  await conv.save();
  res.json({ success: true, data: { message: conv.messages[conv.messages.length - 1] } });
});
