import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { asyncHandler, ApiError } from '../utils/apiError.js';
import { createOAuthState, consumeOAuthState } from '../services/oauthStateService.js';
import {
  getLinkedInAuthUrl,
  handleLinkedInCallback,
  getLinkedInConnection,
  disconnectLinkedIn,
  isLinkedInConfigured,
  LINKEDIN_SCOPES,
} from '../integrations/linkedin/linkedinService.js';
import {
  getGmailAuthUrl,
  handleGmailCallback,
  getGmailConnection,
  isGmailConfigured,
} from '../integrations/gmail/gmailService.js';

export const linkedInConnect = asyncHandler(async (req, res) => {
  if (!isLinkedInConfigured()) {
    throw new ApiError(503, 'LinkedIn OAuth is not configured on the server');
  }
  const state = await createOAuthState(req.user._id, 'linkedin');
  res.json({ success: true, data: { url: getLinkedInAuthUrl(state) } });
});

export const linkedInCallback = asyncHandler(async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  if (error) {
    logger.warn({ error, errorDescription }, 'LinkedIn OAuth returned error');
    const reason = encodeURIComponent(
      [String(error), errorDescription].filter(Boolean).join(': ') || 'authorization_denied'
    );
    return res.redirect(`${env.FRONTEND_URL}/settings?linkedin=error&reason=${reason}`);
  }
  if (!code || !state) {
    return res.redirect(
      `${env.FRONTEND_URL}/settings?linkedin=error&reason=${encodeURIComponent('missing_code_or_state')}`
    );
  }
  try {
    const userId = await consumeOAuthState(state, 'linkedin');
    await handleLinkedInCallback(userId, code);
    return res.redirect(`${env.FRONTEND_URL}/settings?linkedin=connected`);
  } catch (err) {
    logger.error({ err }, 'LinkedIn OAuth callback failed');
    const reason = encodeURIComponent(err.message?.slice(0, 200) || 'callback_failed');
    return res.redirect(`${env.FRONTEND_URL}/settings?linkedin=error&reason=${reason}`);
  }
});

export const linkedInStatus = asyncHandler(async (req, res) => {
  const conn = await getLinkedInConnection(req.user._id);
  res.json({
    success: true,
    data: {
      configured: isLinkedInConfigured(),
      connected: Boolean(conn && conn.connectionStatus === 'connected'),
      status: conn?.connectionStatus || 'disconnected',
      metadata: conn?.metadata,
      redirectUri: env.LINKEDIN_REDIRECT_URI,
      requestedScopes: LINKEDIN_SCOPES,
      requiredProducts:
        'LinkedIn developer app: enable Sign In with LinkedIn (OpenID) + Share on LinkedIn; add scopes openid, profile, email, w_member_social.',
    },
  });
});

export const linkedInDisconnect = asyncHandler(async (req, res) => {
  await disconnectLinkedIn(req.user._id);
  res.json({ success: true });
});

export const gmailConnect = asyncHandler(async (req, res) => {
  if (!isGmailConfigured()) {
    throw new ApiError(503, 'Gmail OAuth is not configured on the server');
  }
  const state = await createOAuthState(req.user._id, 'gmail');
  res.json({ success: true, data: { url: getGmailAuthUrl(state) } });
});

export const gmailCallback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.redirect(`${env.FRONTEND_URL}/settings?gmail=error`);
  }
  try {
    const userId = await consumeOAuthState(state, 'gmail');
    await handleGmailCallback(userId, code);
    return res.redirect(`${env.FRONTEND_URL}/settings?gmail=connected`);
  } catch (err) {
    const msg = encodeURIComponent(err.message?.slice(0, 120) || 'callback_failed');
    return res.redirect(`${env.FRONTEND_URL}/settings?gmail=error&reason=${msg}`);
  }
});

export const gmailStatus = asyncHandler(async (req, res) => {
  const conn = await getGmailConnection(req.user._id);
  res.json({
    success: true,
    data: {
      configured: isGmailConfigured(),
      connected: Boolean(conn && conn.connectionStatus === 'connected'),
      status: conn?.connectionStatus || 'disconnected',
      email: conn?.providerEmail,
    },
  });
});
