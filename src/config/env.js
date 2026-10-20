import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GMAIL_SENDER_EMAIL: z.string().email().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),
  LINKEDIN_API_VERSION: z.string().default('202610'),
  APP_BASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  FILE_STORAGE_PROVIDER: z.enum(['local']).default('local'),
  FILE_STORAGE_CONFIGURATION: z.string().default('{"basePath":"./storage/documents"}'),
  DAILY_GENERATION_CRON: z.string().default('0 10 * * *'),
  /** Comma-separated cron expressions (e.g. 10:00 and 14:00 IST). */
  SCHEDULED_POST_CRONS: z.string().default('0 10 * * *,0 14 * * *'),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),
  APPROVAL_EXPIRY_HOURS: z.coerce.number().default(48),
  RAG_CHUNK_SIZE: z.coerce.number().default(1000),
  RAG_CHUNK_OVERLAP: z.coerce.number().default(200),
  MAX_UPLOAD_BYTES: z.coerce.number().default(10 * 1024 * 1024),
  CRON_SECRET: z.string().min(16).optional(),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export function getScheduledPostCronExpressions() {
  const fromList = env.SCHEDULED_POST_CRONS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromList.length) return fromList;
  return [env.DAILY_GENERATION_CRON];
}

export function getFileStorageConfig() {
  try {
    return JSON.parse(env.FILE_STORAGE_CONFIGURATION);
  } catch {
    return { basePath: './storage/documents' };
  }
}
