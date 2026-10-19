import OpenAI from 'openai';
import { env } from '../config/env.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function embedTexts(texts) {
  if (!texts.length) return [];
  const response = await openai.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedQuery(text) {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
