import path from 'path';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]);

const EXT_MIME = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};

export function validateUpload(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const expectedMime = EXT_MIME[ext];
  if (!expectedMime || file.mimetype !== expectedMime) {
    throw new ApiError(400, 'Unsupported or mismatched file type');
  }
  if (file.size > env.MAX_UPLOAD_BYTES) {
    throw new ApiError(400, 'File too large');
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new ApiError(400, 'Unsupported MIME type');
  }
}
