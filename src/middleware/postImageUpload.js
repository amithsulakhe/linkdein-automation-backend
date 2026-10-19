import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';

const tmpDir = path.join(os.tmpdir(), 'linkedin-ai-post-images');
fs.mkdirSync(tmpDir, { recursive: true });

export const postImageUpload = multer({
  dest: tmpDir,
  limits: { fileSize: 5 * 1024 * 1024 },
});
