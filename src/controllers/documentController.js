import fs from 'fs';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { Document } from '../models/Document.js';
import { saveUploadedDocument, deleteDocument, getDocumentFilePath } from '../services/documentService.js';
import { parsePagination, paginatedResponse } from '../utils/pagination.js';

export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded');
  const doc = await saveUploadedDocument(req.user._id, req.file);
  res.status(201).json({ success: true, data: doc });
});

export const listDocuments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { userId: req.user._id };
  const [items, total] = await Promise.all([
    Document.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Document.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

export const getDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new ApiError(404, 'Not found');
  res.json({ success: true, data: doc });
});

export const removeDocument = asyncHandler(async (req, res) => {
  await deleteDocument(req.user._id, req.params.id);
  res.json({ success: true });
});

export const reprocessDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new ApiError(404, 'Not found');
  doc.processingStatus = 'pending';
  doc.errorInformation = undefined;
  await doc.save();
  const { ingestionQueue } = await import('../queues/ingestionQueue.js');
  await ingestionQueue.add('ingest', {
    documentId: doc._id.toString(),
    userId: req.user._id.toString(),
  });
  res.json({ success: true, data: doc });
});

export const streamDocumentFile = asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new ApiError(404, 'Not found');
  if (doc.fileUrl) return res.redirect(doc.fileUrl);
  const filePath = getDocumentFilePath(doc.storageKey);
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'File missing');
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${doc.originalFilename}"`);
  fs.createReadStream(filePath).pipe(res);
});

export const documentStatus = asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new ApiError(404, 'Not found');
  res.json({
    success: true,
    data: {
      processingStatus: doc.processingStatus,
      extractionStatus: doc.extractionStatus,
      chunkCount: doc.chunkCount,
      errorInformation: doc.errorInformation,
    },
  });
});
