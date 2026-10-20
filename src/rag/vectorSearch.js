import mongoose from 'mongoose';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { embedQuery } from './embeddings.js';

const VECTOR_INDEX = 'document_chunks_vector_index';

/**
 * Semantic search via MongoDB Atlas Vector Search.
 * Requires index on embedding field — see README.
 */
export async function searchDocumentChunks(userId, query, limit = 8, documentId = null) {
  const embedding = await embedQuery(query);
  try {
    const results = await DocumentChunk.aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX,
          path: 'embedding',
          queryVector: embedding,
          numCandidates: limit * 10,
          limit,
          filter: {
            userId: new mongoose.Types.ObjectId(userId),
            ...(documentId ? { documentId: new mongoose.Types.ObjectId(documentId) } : {}),
          },
        },
      },
      {
        $project: {
          text: 1,
          documentName: 1,
          documentId: 1,
          chunkIndex: 1,
          sourceMetadata: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);
    if (results.length) return results;
    return fallbackTextSearch(userId, query, limit, documentId);
  } catch {
    return fallbackTextSearch(userId, query, limit, documentId);
  }
}

async function fallbackTextSearch(userId, query, limit, documentId) {
  const scope = { userId };
  if (documentId) scope.documentId = documentId;
  const words = String(query)
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3 && !word.endsWith('pdf'))
    .slice(0, 8);
  const filter = { ...scope };
  if (words.length) filter.text = new RegExp(words.join('|'), 'i');
  const matches = words.length
    ? await DocumentChunk.find(filter).limit(limit).select('text documentName documentId chunkIndex sourceMetadata').lean()
    : [];
  if (matches.length) return matches;
  return DocumentChunk.find(scope)
    .sort({ chunkIndex: 1 })
    .limit(limit)
    .select('text documentName documentId chunkIndex sourceMetadata')
    .lean();
}
