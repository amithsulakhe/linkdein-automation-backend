import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString(), type: 'refresh' }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
}

export async function registerUser({ email, password, displayName }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'Email already registered');
  }
  const user = new User({ email, displayName });
  await user.setPassword(password);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await user.save();
  const accessToken = signAccessToken(user);
  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokenHash');
  if (!user || user.accountStatus !== 'active') {
    throw new ApiError(401, 'Invalid credentials');
  }
  const valid = await user.verifyPassword(password);
  if (!valid) {
    throw new ApiError(401, 'Invalid credentials');
  }
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await user.save();
  return { user: sanitizeUser(user), accessToken: signAccessToken(user), refreshToken };
}

export async function logoutUser(userId) {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired session');
  }
}

export function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    timezone: user.timezone,
    preferences: user.preferences,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
  };
}
