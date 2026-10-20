import { Document } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { extractTextFromFile } from '../rag/extractors.js';
import { splitTextIntoChunks } from '../rag/chunking.js';
import { embedTexts } from '../rag/embeddings.js';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getDocumentFilePath } from './documentStorage.js';

async function ensureLocalFile(doc) {
  const filePath = getDocumentFilePath(doc.storageKey);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    if (!doc.fileUrl) throw new Error('Uploaded file is no longer on the server');
    const response = await fetch(doc.fileUrl);
    if (!response.ok) throw new Error('Could not download the stored file');
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return filePath;
  }
}

export async function processDocument(documentId, userId) {
  const doc = await Document.findOne({ _id: documentId, userId });
  if (!doc) throw new Error('Document not found');
  doc.processingStatus = 'processing';
  doc.errorInformation = undefined;
  await doc.save();

  try {
    const filePath = await ensureLocalFile(doc);
    const extracted = await extractTextFromFile(filePath, doc.mimeType);
    const text = extracted.text || '';
    doc.pageCount = extracted.pageCount;
    doc.extractionStatus = 'completed';
    if (!text.trim()) {
      throw new Error('No text could be read from this file');
    }
    const chunks = splitTextIntoChunks(text, env.RAG_CHUNK_SIZE, env.RAG_CHUNK_OVERLAP);
    await DocumentChunk.deleteMany({ documentId: doc._id, userId });

    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await embedTexts(batch);
      await DocumentChunk.insertMany(
        batch.map((chunkText, idx) => ({
          userId,
          documentId: doc._id,
          documentName: doc.originalFilename,
          chunkIndex: i + idx,
          text: chunkText,
          embedding: embeddings[idx],
        }))
      );
    }

    doc.chunkCount = chunks.length;
    doc.processingStatus = 'completed';
    await doc.save();
    return { chunkCount: chunks.length, pageCount: doc.pageCount };
  } catch (err) {
    doc.processingStatus = 'failed';
    doc.extractionStatus = 'failed';
    doc.errorInformation = err.message;
    await doc.save();
    logger.error({ err, documentId }, 'Document ingestion failed');
    throw err;
  }
}
