import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getFileStorageConfig } from '../config/env.js';

export function isServerlessRuntime() {
  return Boolean(process.env.VERCEL);
}

export function documentStorageRoot() {
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), 'linkedin-ai-documents');
  }
  return path.resolve(getFileStorageConfig().basePath || './storage/documents');
}

export function getDocumentFilePath(storageKey) {
  return path.join(documentStorageRoot(), String(storageKey).replace(/\//g, path.sep));
}

export async function moveIntoStorage(fromPath, storageKey) {
  const dest = getDocumentFilePath(storageKey);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.rename(fromPath, dest);
  } catch (err) {
    if (err.code !== 'EXDEV' && err.code !== 'EPERM' && err.code !== 'EROFS') throw err;
    await fs.copyFile(fromPath, dest);
    await fs.unlink(fromPath).catch(() => {});
  }
  return dest;
}
