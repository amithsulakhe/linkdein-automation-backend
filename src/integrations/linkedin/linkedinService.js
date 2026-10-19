import fs from 'fs/promises';
import { env } from '../../config/env.js';
import { getPostImagePath } from '../../services/postMediaService.js';
import { OAuthConnection } from '../../models/OAuthConnection.js';
import { decrypt, encrypt } from '../../utils/crypto.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../config/logger.js';

export const LINKEDIN_SCOPES = ['openid', 'profile', 'w_member_social', 'email'];

function linkedInApiVersion() {
  const digits = String(env.LINKEDIN_API_VERSION || '').replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : '202610';
}

const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';

function linkedInRestHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': linkedInApiVersion(),
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

export function isLinkedInConfigured() {
  return Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET && env.LINKEDIN_REDIRECT_URI);
}

export function getLinkedInAuthUrl(state) {
  if (!isLinkedInConfigured()) {
    throw new ApiError(503, 'LinkedIn integration is not configured');
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.LINKEDIN_CLIENT_ID,
    redirect_uri: env.LINKEDIN_REDIRECT_URI,
    state,
    scope: LINKEDIN_SCOPES.join(' '),
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.LINKEDIN_REDIRECT_URI,
    client_id: env.LINKEDIN_CLIENT_ID,
    client_secret: env.LINKEDIN_CLIENT_SECRET,
  });
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, text }, 'LinkedIn token exchange failed');
    throw new ApiError(502, `LinkedIn token error (${res.status}): ${text.slice(0, 120)}`);
  }
  return res.json();
}

export async function handleLinkedInCallback(userId, code) {
  const tokens = await exchangeCodeForTokens(code);
  const profile = await fetchLinkedInProfile(tokens.access_token);
  const expiry = tokens.expires_in
    ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
    : undefined;

  await OAuthConnection.findOneAndUpdate(
    { userId, provider: 'linkedin' },
    {
      userId,
      provider: 'linkedin',
      encryptedAccessToken: encrypt(tokens.access_token),
      encryptedRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
      tokenExpiry: expiry,
      grantedScopes: LINKEDIN_SCOPES,
      connectionStatus: 'connected',
      providerUserId: profile.sub,
      metadata: { name: profile.name, email: profile.email },
    },
    { upsert: true, new: true }
  );
  return profile;
}

async function fetchLinkedInProfile(accessToken) {
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new ApiError(502, 'Failed to fetch LinkedIn profile');
  }
  return res.json();
}

export async function getLinkedInConnection(userId) {
  return OAuthConnection.findOne({ userId, provider: 'linkedin' });
}

export async function getLinkedInAccessToken(userId) {
  const conn = await getLinkedInConnection(userId);
  if (!conn || conn.connectionStatus !== 'connected') {
    throw new ApiError(400, 'LinkedIn account not connected');
  }
  if (conn.tokenExpiry && conn.tokenExpiry < new Date()) {
    conn.connectionStatus = 'expired';
    await conn.save();
    throw new ApiError(401, 'LinkedIn token expired — reconnect required');
  }
  return decrypt(conn.encryptedAccessToken);
}

function authorUrn(conn) {
  return conn.providerUserId?.startsWith('urn:')
    ? conn.providerUserId
    : `urn:li:person:${conn.providerUserId}`;
}

async function uploadImageForPost(userId, author, imageStorageKey, mimeType) {
  const accessToken = await getLinkedInAccessToken(userId);
  const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: linkedInRestHeaders(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
  });
  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new ApiError(502, `LinkedIn image init failed: ${initRes.status}`, { body: errText });
  }
  const initData = await initRes.json();
  const uploadUrl = initData.value?.uploadUrl;
  const imageUrn = initData.value?.image;
  if (!uploadUrl || !imageUrn) {
    throw new ApiError(502, 'LinkedIn image upload response incomplete');
  }
  const buffer = await fs.readFile(getPostImagePath(imageStorageKey));
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': mimeType || 'application/octet-stream',
    },
    body: buffer,
  });
  if (!uploadRes.ok) {
    throw new ApiError(502, `LinkedIn image upload failed: ${uploadRes.status}`);
  }
  return imageUrn;
}

export async function publishPost(userId, post) {
  if (post.imageStorageKey) {
    return publishPostWithImage(userId, post);
  }
  return publishTextPost(userId, post.content);
}

async function publishPostWithImage(userId, post) {
  const accessToken = await getLinkedInAccessToken(userId);
  const conn = await getLinkedInConnection(userId);
  const author = authorUrn(conn);
  const imageUrn = await uploadImageForPost(userId, author, post.imageStorageKey, post.imageMimeType);

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: linkedInRestHeaders(accessToken),
    body: JSON.stringify({
      author,
      commentary: post.content,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED' },
      content: { media: { id: imageUrn } },
      lifecycleState: 'PUBLISHED',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error({ status: res.status, errText }, 'LinkedIn publish with image failed');
    throw new ApiError(502, `LinkedIn publish failed: ${res.status}`, { body: errText });
  }

  const postId = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id');
  return {
    linkedInPostId: postId,
    publishedUrl: postId ? `https://www.linkedin.com/feed/update/${postId}` : null,
  };
}

export async function publishTextPost(userId, text) {
  const accessToken = await getLinkedInAccessToken(userId);
  const conn = await getLinkedInConnection(userId);
  const author = authorUrn(conn);

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: linkedInRestHeaders(accessToken),
    body: JSON.stringify({
      author,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED' },
      lifecycleState: 'PUBLISHED',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error({ status: res.status, errText }, 'LinkedIn publish failed');
    throw new ApiError(502, `LinkedIn publish failed: ${res.status}`, { body: errText });
  }

  const postId = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id');
  return {
    linkedInPostId: postId,
    publishedUrl: postId ? `https://www.linkedin.com/feed/update/${postId}` : null,
  };
}

export async function syncPostMetrics(userId, linkedInPostId) {
  if (!linkedInPostId) {
    return { metricsSource: 'unavailable', reason: 'No LinkedIn post ID' };
  }
  try {
    const accessToken = await getLinkedInAccessToken(userId);
    const res = await fetch(
      `https://api.linkedin.com/rest/postAnalytics?q=entity&entity=${encodeURIComponent(linkedInPostId)}`,
      { headers: linkedInRestHeaders(accessToken) }
    );
    if (!res.ok) {
      return {
        metricsSource: 'unavailable',
        reason:
          'LinkedIn post analytics require additional API products or permissions. Connect LinkedIn and verify developer app access.',
        status: res.status,
      };
    }
    const data = await res.json();
    return { metricsSource: 'linkedin_api', rawMetrics: data };
  } catch (err) {
    return { metricsSource: 'unavailable', reason: err.message };
  }
}

export async function disconnectLinkedIn(userId) {
  await OAuthConnection.deleteOne({ userId, provider: 'linkedin' });
}
