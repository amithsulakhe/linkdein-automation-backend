import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Document } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { env, getFileStorageConfig } from '../config/env.js';
import { validateUpload } from '../validators/documentValidation.js';
import { ApiError } from '../utils/apiError.js';

export { validateUpload };

async function ensureStorageDir() {
  const { basePath } = getFileStorageConfig();
  const full = path.resolve(basePath);
  await fs.mkdir(full, { recursive: true });
  return full;
}

export async function saveUploadedDocument(userId, file) {
  validateUpload(file);
  const storageDir = await ensureStorageDir();
  const storageKey = `${userId}/${crypto.randomUUID()}${path.extname(file.originalname)}`;
  const dest = path.join(storageDir, storageKey.replace(/\//g, path.sep));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(file.path, dest);

  const doc = await Document.create({
    userId,
    originalFilename: file.originalname,
    storageKey,
    mimeType: file.mimetype,
    fileSize: file.size,
    processingStatus: 'pending',
  });

  const { ingestionQueue } = await import('../queues/ingestionQueue.js');
  await ingestionQueue.add('ingest', { documentId: doc._id.toString(), userId: userId.toString() });
  return doc;
}

export async function deleteDocument(userId, documentId) {
  const doc = await Document.findOne({ _id: documentId, userId });
  if (!doc) {
    throw new ApiError(404, 'Document not found');
  }
  const { basePath } = getFileStorageConfig();
  const filePath = path.join(basePath, doc.storageKey.replace(/\//g, path.sep));
  try {
    await fs.unlink(filePath);
  } catch {
    /* file may already be gone */
  }
  await DocumentChunk.deleteMany({ documentId: doc._id, userId });
  await doc.deleteOne();
}

export function getDocumentFilePath(storageKey) {
  const { basePath } = getFileStorageConfig();
  return path.join(basePath, storageKey.replace(/\//g, path.sep));
}
