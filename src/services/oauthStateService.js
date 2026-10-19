import crypto from 'crypto';
import { OAuthState } from '../models/OAuthState.js';
import { ApiError } from '../utils/apiError.js';

export async function createOAuthState(userId, provider) {
  const state = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await OAuthState.create({ state, userId, provider, expiresAt });
  return state;
}

export async function consumeOAuthState(state, provider) {
  const record = await OAuthState.findOneAndDelete({ state, provider });
  if (!record) {
    throw new ApiError(400, 'Invalid or expired OAuth state');
  }
  if (record.expiresAt < new Date()) {
    throw new ApiError(400, 'OAuth state expired');
  }
  return record.userId;
}
