import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { Document } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { validateUpload } from '../validators/documentValidation.js';
import { ApiError } from '../utils/apiError.js';
import { uploadDocumentFile, deleteCloudinaryFile } from './cloudinaryService.js';
import { processDocument } from './documentIngestion.js';
import { getDocumentFilePath, isServerlessRuntime, moveIntoStorage } from './documentStorage.js';
import { logger } from '../config/logger.js';

export { validateUpload };

async function keepProcessingAlive(task) {
  if (!isServerlessRuntime()) return false;
  try {
    const { waitUntil } = await import('@vercel/functions');
    waitUntil(task);
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, 'Could not extend the serverless invocation for document processing');
    return false;
  }
}

export async function saveUploadedDocument(userId, file) {
  validateUpload(file);
  const storageKey = `${userId}/${crypto.randomUUID()}${path.extname(file.originalname || '')}`;
  let dest;
  try {
    dest = await moveIntoStorage(file.path, storageKey);
  } catch (err) {
    logger.error({ err }, 'Failed to store uploaded file');
    throw new ApiError(500, 'Could not store the uploaded file');
  }

  let cloud = null;
  try {
    cloud = await uploadDocumentFile(dest, { userId: userId.toString(), filename: file.originalname });
  } catch (err) {
    logger.warn({ err: err.message }, 'Cloudinary upload failed; file kept locally');
  }

  const doc = await Document.create({
    userId,
    originalFilename: file.originalname,
    storageKey,
    mimeType: file.mimetype,
    fileSize: file.size,
    processingStatus: 'pending',
    fileUrl: cloud?.fileUrl,
    cloudinaryPublicId: cloud?.publicId,
  });

  const processing = processDocument(doc._id, userId).catch((err) => {
    logger.error({ err: err.message, documentId: doc._id }, 'Background document processing failed');
  });
  if (isServerlessRuntime()) {
    const extended = await keepProcessingAlive(processing);
    if (!extended || !cloud?.fileUrl) await processing;
  }
  return doc;
}

export async function deleteDocument(userId, documentId) {
  const doc = await Document.findOne({ _id: documentId, userId });
  if (!doc) {
    throw new ApiError(404, 'Document not found');
  }
  const filePath = getDocumentFilePath(doc.storageKey);
  try {
    await fs.unlink(filePath);
  } catch {
    /* file may already be gone */
  }
  try {
    await deleteCloudinaryFile(doc.cloudinaryPublicId);
  } catch {
    /* cloud file may already be gone */
  }
  await DocumentChunk.deleteMany({ documentId: doc._id, userId });
  await doc.deleteOne();
}

export async function resumeStuckDocuments() {
  const stuck = await Document.find({ processingStatus: { $in: ['pending', 'processing'] } }).select('_id userId');
  for (const doc of stuck) {
    processDocument(doc._id, doc.userId).catch((err) => {
      logger.error({ err: err.message, documentId: doc._id }, 'Resume document processing failed');
    });
  }
}

export { getDocumentFilePath };
