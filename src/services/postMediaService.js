import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ApiError } from '../utils/apiError.js';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const STORAGE_DIR = path.resolve('./storage/post-images');

export async function ensurePostImageDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

export function validatePostImage(file) {
  if (!file) return;
  if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
    throw new ApiError(400, 'Image must be JPEG, PNG, GIF, or WebP');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ApiError(400, 'Image must be 5 MB or smaller');
  }
}

export async function savePostImage(userId, file) {
  validatePostImage(file);
  await ensurePostImageDir();
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const storageKey = `${userId}/${crypto.randomUUID()}${ext}`;
  const dest = path.join(STORAGE_DIR, storageKey.replace(/\//g, path.sep));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(file.path, dest);
  return {
    imageStorageKey: storageKey,
    imageOriginalName: file.originalname,
    imageMimeType: file.mimetype,
  };
}

export function getPostImagePath(storageKey) {
  return path.join(STORAGE_DIR, storageKey.replace(/\//g, path.sep));
}

export async function deletePostImage(storageKey) {
  if (!storageKey) return;
  try {
    await fs.unlink(getPostImagePath(storageKey));
  } catch {
    /* ignore */
  }
}
