import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.createHash('sha256').update(env.TOKEN_ENCRYPTION_KEY).digest();

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertext) {
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashContent(content) {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

export function generateIdempotencyKey(...parts) {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex');
}
