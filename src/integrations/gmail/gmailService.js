import { google } from 'googleapis';
import { env } from '../../config/env.js';
import { OAuthConnection } from '../../models/OAuthConnection.js';
import { encrypt, decrypt } from '../../utils/crypto.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../config/logger.js';
import { formatDisplayDate, toPlainLinkedInText } from '../../utils/plainPostText.js';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

export function isGmailConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

export function getGmailAuthUrl(state) {
  if (!isGmailConfigured()) {
    throw new ApiError(503, 'Gmail integration is not configured');
  }
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
  });
}

export async function handleGmailCallback(userId, code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let providerEmail = env.GMAIL_SENDER_EMAIL;
  let providerUserId = undefined;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const profile = await oauth2.userinfo.get();
    providerEmail = profile.data.email || providerEmail;
    providerUserId = profile.data.id;
  } catch (err) {
    logger.warn({ err: err.message }, 'Gmail userinfo unavailable; using configured sender email');
  }

  const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

  await OAuthConnection.findOneAndUpdate(
    { userId, provider: 'gmail' },
    {
      userId,
      provider: 'gmail',
      encryptedAccessToken: encrypt(tokens.access_token),
      encryptedRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
      tokenExpiry: expiry,
      grantedScopes: GMAIL_SCOPES,
      connectionStatus: 'connected',
      providerEmail,
      providerUserId,
    },
    { upsert: true, new: true }
  );
  return { email: providerEmail, id: providerUserId };
}

async function getAuthenticatedGmailClient(userId) {
  const conn = await OAuthConnection.findOne({ userId, provider: 'gmail' });
  if (!conn || conn.connectionStatus !== 'connected') {
    throw new ApiError(400, 'Gmail not connected');
  }
  const client = createOAuthClient();
  client.setCredentials({
    access_token: decrypt(conn.encryptedAccessToken),
    refresh_token: conn.encryptedRefreshToken ? decrypt(conn.encryptedRefreshToken) : undefined,
    expiry_date: conn.tokenExpiry?.getTime(),
  });

  client.on('tokens', async (tokens) => {
    const update = {};
    if (tokens.access_token) {
      update.encryptedAccessToken = encrypt(tokens.access_token);
    }
    if (tokens.refresh_token) {
      update.encryptedRefreshToken = encrypt(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      update.tokenExpiry = new Date(tokens.expiry_date);
    }
    if (Object.keys(update).length) {
      await OAuthConnection.updateOne({ userId, provider: 'gmail' }, update);
    }
  });

  return google.gmail({ version: 'v1', auth: client });
}

function wrapBase64(raw) {
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function chunkBase64(buffer) {
  return buffer.toString('base64').replace(/(.{76})/g, '$1\r\n');
}

function buildRawEmail({ to, subject, html, from, inlineImage }) {
  if (!inlineImage) {
    const message = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ].join('\r\n');
    return wrapBase64(message);
  }

  const boundary = `rel_${Date.now()}`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    `--${boundary}`,
    `Content-Type: ${inlineImage.mime}; name="linkedin-post.png"`,
    'Content-Transfer-Encoding: base64',
    'Content-ID: <postimage>',
    'Content-Disposition: inline; filename="linkedin-post.png"',
    '',
    chunkBase64(inlineImage.buffer),
    `--${boundary}--`,
  ].join('\r\n');
  return wrapBase64(message);
}

export async function sendApprovalEmail({
  userId,
  toEmail,
  postContent,
  topic,
  generationDate,
  approveUrl,
  rejectUrl,
  dashboardUrl,
  expiresAt,
  hasImage,
  imageBuffer,
  imageMimeType,
  timeZone,
  subjectPrefix = '[Action required]',
  introLine = 'Opening a link alone does not publish. You must confirm on the secure page.',
}) {
  const conn = await OAuthConnection.findOne({ userId, provider: 'gmail' });
  const gmail = await getAuthenticatedGmailClient(userId);
  // Gmail API requires From to match the connected Google account.
  const from = conn?.providerEmail || env.GMAIL_SENDER_EMAIL || toEmail;
  const plain = toPlainLinkedInText(postContent);
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1d2226;max-width:560px">
    <h2 style="font-size:20px;margin:0 0 8px">LinkedIn post approval required</h2>
    <p style="color:#666;font-size:13px;margin:0 0 16px">Created ${escapeHtml(formatDisplayDate(generationDate, timeZone))} · Expires ${escapeHtml(formatDisplayDate(expiresAt, timeZone))}</p>
    <div style="border:1px solid #e6e6e6;border-radius:12px;padding:16px;background:#fff">
      <p style="margin:0 0 12px;font-size:16px;font-weight:700">${escapeHtml(topic)}</p>
      <p style="margin:0;white-space:pre-wrap;font-size:14px;line-height:1.5">${escapeHtml(plain)}</p>
      ${imageBuffer ? '<img src="cid:postimage" alt="Post image" style="display:block;width:100%;margin-top:16px;border-radius:8px" />' : ''}
    </div>
    <p style="font-size:13px;color:#444">${escapeHtml(introLine)}</p>
    <p style="margin:16px 0">
      <a href="${approveUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px">Review &amp; approve</a>
      <a href="${rejectUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px">Review &amp; reject</a>
    </p>
    <p><a href="${dashboardUrl}">Open dashboard</a></p>
    </div>
  `;

  const raw = buildRawEmail({
    to: toEmail,
    from,
    subject: `${subjectPrefix} Approve LinkedIn post: ${topic}`,
    html,
    inlineImage: imageBuffer ? { buffer: imageBuffer, mime: imageMimeType || 'image/png' } : null,
  });

  try {
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
    return { messageId: result.data.id, status: 'sent' };
  } catch (err) {
    logger.error({ err }, 'Gmail send failed');
    throw new ApiError(502, 'Failed to send approval email', { cause: err.message });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendPostPublishedEmail({
  userId,
  toEmail,
  topic,
  postContent,
  publishedUrl,
}) {
  const conn = await OAuthConnection.findOne({ userId, provider: 'gmail' });
  const gmail = await getAuthenticatedGmailClient(userId);
  const from = conn?.providerEmail || env.GMAIL_SENDER_EMAIL || toEmail;
  const linkBlock = publishedUrl
    ? `<p><a href="${escapeHtml(publishedUrl)}">View on LinkedIn</a></p>`
    : '';
  const html = `
    <h2>Your LinkedIn post is live</h2>
    <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
    <p>You approved this post and it was published successfully.</p>
    <hr/>
    <pre style="white-space:pre-wrap;font-family:inherit;background:#f5f5f5;padding:16px;">${escapeHtml(postContent)}</pre>
    ${linkBlock}
  `;
  const raw = buildRawEmail({
    to: toEmail,
    from,
    subject: `[Published] LinkedIn post: ${topic}`,
    html,
  });
  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return { messageId: result.data.id, status: 'sent' };
}

export async function sendScheduledPostEmail({
  userId,
  toEmail,
  topic,
  postContent,
  slotLabel,
  calendarUrl,
}) {
  const conn = await OAuthConnection.findOne({ userId, provider: 'gmail' });
  const gmail = await getAuthenticatedGmailClient(userId);
  const from = conn?.providerEmail || env.GMAIL_SENDER_EMAIL || toEmail;
  const html = `
    <h2>Scheduled LinkedIn post (${escapeHtml(slotLabel)} IST)</h2>
    <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
    <p>Your AI agent generated this post and queued it for LinkedIn publishing.</p>
    <hr/>
    <h3>Post preview</h3>
    <pre style="white-space:pre-wrap;font-family:inherit;background:#f5f5f5;padding:16px;">${escapeHtml(postContent)}</pre>
    <p><a href="${calendarUrl}">View status on Content Calendar</a></p>
  `;
  const raw = buildRawEmail({
    to: toEmail,
    from,
    subject: `[Scheduled] LinkedIn post: ${topic}`,
    html,
  });
  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return { messageId: result.data.id, status: 'sent' };
}

export async function getGmailConnection(userId) {
  return OAuthConnection.findOne({ userId, provider: 'gmail' });
}
