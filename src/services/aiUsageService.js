import { AiUsage } from '../models/AiUsage.js';

/** Public list prices in USD per 1,000,000 tokens. Estimates, not an invoice. */
const RATES = {
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4.1-mini': { in: 0.4, out: 1.6 },
  'gpt-4.1': { in: 2, out: 8 },
  'gpt-4.1-nano': { in: 0.1, out: 0.4 },
  'text-embedding-3-small': { in: 0.02, out: 0 },
  'text-embedding-3-large': { in: 0.13, out: 0 },
};

export function priceUsage(model, usage = {}) {
  const rates = RATES[model] || RATES['gpt-4o-mini'];
  const promptTokens = usage.prompt_tokens ?? usage.promptTokens ?? usage.input_tokens ?? usage.inputTokens ?? 0;
  const completionTokens =
    usage.completion_tokens ?? usage.completionTokens ?? usage.output_tokens ?? usage.outputTokens ?? 0;
  const costUsd =
    usage.costUsd != null
      ? Number(usage.costUsd)
      : Number(((promptTokens * rates.in + completionTokens * rates.out) / 1_000_000).toFixed(6));
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costUsd,
  };
}

export function usageFromLangChain(message) {
  return message?.usage_metadata || message?.response_metadata?.usage || message?.response_metadata?.tokenUsage || {};
}

export async function recordAiUsage({ userId, postId, purpose, model, usage }) {
  const priced = priceUsage(model, usage);
  const doc = await AiUsage.create({
    userId,
    postId: postId || undefined,
    purpose,
    model,
    ...priced,
  });
  return doc;
}

export async function summarizeAiUsage(userId) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [all, month] = await Promise.all([
    AiUsage.aggregate([
      { $match: { userId } },
      { $group: { _id: null, costUsd: { $sum: '$costUsd' }, tokens: { $sum: '$totalTokens' }, calls: { $sum: 1 } } },
    ]),
    AiUsage.aggregate([
      { $match: { userId, createdAt: { $gte: monthStart } } },
      { $group: { _id: '$purpose', costUsd: { $sum: '$costUsd' }, tokens: { $sum: '$totalTokens' }, calls: { $sum: 1 } } },
    ]),
  ]);

  const monthCostUsd = month.reduce((sum, row) => sum + row.costUsd, 0);
  return {
    totalCostUsd: all[0]?.costUsd || 0,
    totalTokens: all[0]?.tokens || 0,
    totalCalls: all[0]?.calls || 0,
    monthCostUsd,
    monthByPurpose: month.map((row) => ({
      purpose: row._id,
      costUsd: row.costUsd,
      tokens: row.tokens,
      calls: row.calls,
    })),
    note: 'Estimated from public token prices. Your OpenAI invoice can differ.',
  };
}
