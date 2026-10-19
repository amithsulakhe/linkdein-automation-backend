import { Worker } from 'bullmq';
import { getRedisConnection } from '../queues/connection.js';
import { Document } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { extractTextFromFile } from '../rag/extractors.js';
import { splitTextIntoChunks } from '../rag/chunking.js';
import { embedTexts } from '../rag/embeddings.js';
import { getDocumentFilePath } from '../services/documentService.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export function startIngestionWorker() {
  const worker = new Worker(
    'document-ingestion',
    async (job) => {
      const { documentId, userId } = job.data;
      const doc = await Document.findOne({ _id: documentId, userId });
      if (!doc) {
        throw new Error('Document not found');
      }
      doc.processingStatus = 'processing';
      await doc.save();

      try {
        const filePath = getDocumentFilePath(doc.storageKey);
        const text = await extractTextFromFile(filePath, doc.mimeType);
        doc.extractionStatus = 'completed';
        const chunks = splitTextIntoChunks(text, env.RAG_CHUNK_SIZE, env.RAG_CHUNK_OVERLAP);
        await DocumentChunk.deleteMany({ documentId: doc._id, userId });

        const batchSize = 20;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          const embeddings = await embedTexts(batch);
          const docs = batch.map((chunkText, idx) => ({
            userId,
            documentId: doc._id,
            documentName: doc.originalFilename,
            chunkIndex: i + idx,
            text: chunkText,
            embedding: embeddings[idx],
          }));
          await DocumentChunk.insertMany(docs);
        }

        doc.chunkCount = chunks.length;
        doc.processingStatus = 'completed';
        await doc.save();
        return { chunkCount: chunks.length };
      } catch (err) {
        doc.processingStatus = 'failed';
        doc.extractionStatus = 'failed';
        doc.errorInformation = err.message;
        await doc.save();
        logger.error({ err, documentId }, 'Document ingestion failed');
        throw err;
      }
    },
    { connection: getRedisConnection(), concurrency: 2 }
  );
  return worker;
}
