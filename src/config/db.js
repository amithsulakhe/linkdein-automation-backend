import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  const opts = { serverSelectionTimeoutMS: 15000 };
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, opts);
      logger.info('MongoDB connected');
      return;
    } catch (err) {
      lastErr = err;
      logger.warn({ attempt, err: err.message }, 'MongoDB connect retry');
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error(
    `MongoDB unreachable (${lastErr?.message}). Check internet/VPN, Atlas IP allowlist, and MONGODB_URI in .env`
  );
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
