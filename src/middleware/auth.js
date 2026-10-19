import { verifyAccessToken, sanitizeUser } from '../services/authService.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.accessToken;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;
  if (!token) {
    return next(new ApiError(401, 'Authentication required'));
  }
  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export async function loadUser(req, res, next) {
  if (!req.auth?.sub) {
    return next(new ApiError(401, 'Authentication required'));
  }
  const user = await User.findById(req.auth.sub);
  if (!user || user.accountStatus !== 'active') {
    return next(new ApiError(401, 'Authentication required'));
  }
  req.user = user;
  next();
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.accessToken;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;
  if (!token) {
    return next();
  }
  try {
    req.auth = verifyAccessToken(token);
  } catch {
    /* ignore */
  }
  next();
}

export function attachSanitizedUser(req, res, next) {
  if (req.user) {
    req.sanitizedUser = sanitizeUser(req.user);
  }
  next();
}
