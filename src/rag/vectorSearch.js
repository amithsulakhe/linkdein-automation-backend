import mongoose from 'mongoose';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { embedQuery } from './embeddings.js';

const VECTOR_INDEX = 'document_chunks_vector_index';

/**
 * Semantic search via MongoDB Atlas Vector Search.
 * Requires index on embedding field — see README.
 */
export async function searchDocumentChunks(userId, query, limit = 8) {
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
          filter: { userId: new mongoose.Types.ObjectId(userId) },
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
    return results;
  } catch (err) {
    if (err.message?.includes('$vectorSearch')) {
      return fallbackTextSearch(userId, query, limit);
    }
    throw err;
  }
}

async function fallbackTextSearch(userId, query, limit) {
  const regex = new RegExp(query.split(/\s+/).slice(0, 5).join('|'), 'i');
  return DocumentChunk.find({ userId, text: regex })
    .limit(limit)
    .select('text documentName documentId chunkIndex sourceMetadata')
    .lean();
}
