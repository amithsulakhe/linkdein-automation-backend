import { StateGraph, END } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { Post } from '../../models/Post.js';
import { User } from '../../models/User.js';
import { hashContent } from '../../utils/crypto.js';
import { searchDocumentChunks } from '../../rag/vectorSearch.js';
import {
  createApprovalRequestForPost,
  sendApprovalEmailForRequest,
} from '../../services/approvalService.js';
import { slotIdToLabel } from '../../utils/userSchedule.js';
import { logger } from '../../config/logger.js';
import { resolveContentBrief } from '../../constants/contentTypes.js';
import { recordAiUsage, usageFromLangChain } from '../../services/aiUsageService.js';
import { toPlainLinkedInText } from '../../utils/plainPostText.js';
const PostState = Annotation.Root({
  userId: Annotation(),
  jobDateKey: Annotation(),
  slotId: Annotation(),
  topic: Annotation(),
  knowledgeContext: Annotation(),
  recentPostsSummary: Annotation(),
  generatedPost: Annotation(),
  hashtags: Annotation(),
  validationErrors: Annotation(),
  postId: Annotation(),
  approvalToken: Annotation(),
  error: Annotation(),
  aiUsage: Annotation(),
});

const postOutputSchema = z.object({
  content: z.string().min(100).max(3000),
  hashtags: z.array(z.string()).max(8),
});

function createModel() {
  return new ChatOpenAI({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0.7,
    apiKey: env.OPENAI_API_KEY,
  });
}

async function selectTopic(state) {
  const user = await User.findById(state.userId);
  const contentType = user?.preferences?.contentType || 'javascript';
  const topics = user?.preferences?.defaultTopics || [];
  const recent = await Post.find({ userId: state.userId, status: { $ne: 'GENERATION_FAILED' } })
    .sort({ createdAt: -1 })
    .limit(14)
    .select('topic content')
    .lean();
  const recentTopics = recent.map((p) => p.topic);
  const available = topics.filter((t) => !recentTopics.slice(0, 5).includes(t));
  const slotOffset = state.slotId?.includes('h14') ? 1 : 0;
  const rotated = [...available.slice(slotOffset), ...available.slice(0, slotOffset)];
  const fallback =
    contentType === 'javascript'
      ? 'JavaScript performance optimization'
      : resolveContentBrief(user?.preferences).slice(0, 120);
  const topic =
    contentType === 'javascript'
      ? rotated[0] || topics[(slotOffset + recent.length) % Math.max(topics.length, 1)] || fallback
      : fallback;
  const recentPostsSummary = recent.map((p) => `- ${p.topic}: ${p.content.slice(0, 120)}...`).join('\n');
  return { topic, recentPostsSummary };
}

async function retrieveRelevantKnowledge(state) {
  const chunks = await searchDocumentChunks(state.userId, state.topic, 6);
  const knowledgeContext = chunks
    .map((c, i) => `[${i + 1}] (${c.documentName}${c.sourceMetadata?.page ? ` p.${c.sourceMetadata.page}` : ''}): ${c.text.slice(0, 500)}`)
    .join('\n\n');
  return { knowledgeContext };
}

async function generatePost(state) {
  const user = await User.findById(state.userId);
  const contentBrief = resolveContentBrief(user?.preferences);
  const model = createModel();
  const prompt = `You are an expert LinkedIn author. Every post must stay inside this content type:
${contentBrief}

Topic: ${state.topic}
Scheduled slot: ${state.slotId ? slotIdToLabel(state.slotId) : 'manual'}

Recent posts to avoid repeating:
${state.recentPostsSummary || 'None'}

Knowledge base excerpts (use only when accurate; do not invent citations):
${state.knowledgeContext || 'No documents retrieved.'}

Write one LinkedIn post with:
- Strong opening hook
- Practical, technically accurate insights
- Natural professional tone (not generic marketing)
- Clear conclusion
- No fabricated statistics or fake citations
- 3-6 relevant hashtags
- Plain text only. Do not use markdown, asterisks, or bold markers.

Return JSON with keys: content, hashtags (array without # prefix).`;

  const structured = model.withStructuredOutput(postOutputSchema, { includeRaw: true });
  const result = await structured.invoke(prompt);
  const parsed = result.parsed || result;
  let aiUsage = null;
  try {
    aiUsage = await recordAiUsage({
      userId: state.userId,
      purpose: 'scheduled_post',
      model: env.OPENAI_CHAT_MODEL,
      usage: usageFromLangChain(result.raw),
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to record scheduled post AI usage');
  }
  return { generatedPost: toPlainLinkedInText(parsed.content), hashtags: parsed.hashtags, aiUsage };
}

async function validatePost(state) {
  const errors = [];
  const content = state.generatedPost || '';
  if (content.length < 100) errors.push('Post too short');
  if (content.length > 3000) errors.push('Post too long');
  if (/(\d{2,3})%\s+(increase|growth|boost)/i.test(content) && !state.knowledgeContext) {
    errors.push('Avoid unsupported statistics');
  }
  const recent = await Post.findOne({
    userId: state.userId,
    contentHash: hashContent(content),
  });
  if (recent) errors.push('Duplicate content detected');
  if (errors.length) {
    return { validationErrors: errors, error: errors.join('; ') };
  }
  return { validationErrors: [] };
}

async function saveDraft(state) {
  if (state.validationErrors?.length) {
    return { error: state.validationErrors.join('; ') };
  }
  let fullContent = toPlainLinkedInText(state.generatedPost);
  if (state.hashtags?.length) {
    fullContent += `\n\n${state.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}`;
  }
  const post = await Post.create({
    userId: state.userId,
    topic: state.topic,
    content: fullContent,
    contentHash: hashContent(fullContent),
    hashtags: state.hashtags,
    status: 'DRAFT',
    generationSource: 'scheduled',
    scheduledGenerationTime: new Date(),
    metadata: { jobDateKey: state.jobDateKey },
    aiModel: state.aiUsage?.model,
    aiPromptTokens: state.aiUsage?.promptTokens || 0,
    aiCompletionTokens: state.aiUsage?.completionTokens || 0,
    aiCostUsd: state.aiUsage?.costUsd || 0,
  });
  if (state.aiUsage?._id) {
    state.aiUsage.postId = post._id;
    await state.aiUsage.save();
  }
  return { postId: post._id.toString() };
}

async function createApprovalRequest(state) {
  if (state.error || !state.postId) return {};
  const { approval, rawToken } = await createApprovalRequestForPost(
    state.userId,
    state.postId,
    null
  );
  return { approvalToken: rawToken, approvalId: approval._id.toString() };
}

async function sendApprovalEmailNode(state) {
  if (state.error || !state.postId || !state.approvalToken) return {};
  const user = await User.findById(state.userId);
  if (user?.preferences?.emailNotifications === false) return {};
  try {
    const post = await Post.findById(state.postId);
    if (post?.approvalRequestId) {
      await sendApprovalEmailForRequest(
        state.userId,
        post.approvalRequestId,
        user.email,
        state.approvalToken
      );
    }
  } catch (err) {
    logger.error({ err }, 'Approval email failed');
    return { error: `Email failed: ${err.message}` };
  }
  return {};
}

async function recordFinalStatus(state) {
  if (state.error && state.postId) {
    await Post.findByIdAndUpdate(state.postId, {
      status: 'GENERATION_FAILED',
      lastPublishingError: state.error,
    });
  }
  return {};
}

function routeAfterValidate(state) {
  if (state.validationErrors?.length) return 'record_final_status';
  return 'save_draft';
}

function routeAfterSave(state) {
  if (state.error) return 'record_final_status';
  return 'create_approval_request';
}

export function buildDailyPostGraph() {
  const graph = new StateGraph(PostState)
    .addNode('select_topic', selectTopic)
    .addNode('retrieve_relevant_knowledge', retrieveRelevantKnowledge)
    .addNode('generate_post', generatePost)
    .addNode('validate_post', validatePost)
    .addNode('save_draft', saveDraft)
    .addNode('create_approval_request', createApprovalRequest)
    .addNode('send_approval_email', sendApprovalEmailNode)
    .addNode('record_final_status', recordFinalStatus)
    .addEdge('__start__', 'select_topic')
    .addEdge('select_topic', 'retrieve_relevant_knowledge')
    .addEdge('retrieve_relevant_knowledge', 'generate_post')
    .addEdge('generate_post', 'validate_post')
    .addConditionalEdges('validate_post', routeAfterValidate, {
      save_draft: 'save_draft',
      record_final_status: 'record_final_status',
    })
    .addConditionalEdges('save_draft', routeAfterSave, {
      create_approval_request: 'create_approval_request',
      record_final_status: 'record_final_status',
    })
    .addEdge('create_approval_request', 'send_approval_email')
    .addEdge('send_approval_email', 'record_final_status')
    .addEdge('record_final_status', END);

  return graph.compile();
}

export async function runDailyPostWorkflow(userId, jobDateKey, slotId = 'h10-m0') {
  const app = buildDailyPostGraph();
  const result = await app.invoke({
    userId: userId.toString(),
    jobDateKey,
    slotId,
    validationErrors: [],
  });
  return result;
}
