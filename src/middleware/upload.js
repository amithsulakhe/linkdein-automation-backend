import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { env } from '../config/env.js';

const tmpDir = path.join(os.tmpdir(), 'linkedin-ai-uploads');
fs.mkdirSync(tmpDir, { recursive: true });

export const uploadMiddleware = multer({
  dest: tmpDir,
  limits: { fileSize: env.MAX_UPLOAD_BYTES },
});
