import { env } from '../config/env.js';
import {
  registerUser,
  loginUser,
  logoutUser,
  sanitizeUser,
} from '../services/authService.js';
import { asyncHandler } from '../utils/apiError.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  path: '/',
};

export const register = asyncHandler(async (req, res) => {
  const result = await registerUser(req.body);
  res.cookie('accessToken', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.status(201).json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.body);
  res.cookie('accessToken', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
});

export const logout = asyncHandler(async (req, res) => {
  await logoutUser(req.user._id);
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  res.json({ success: true });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: sanitizeUser(req.user) } });
});
