/**
 * Gmail OAuth + send for Lanyard (server-side — keeps client secret off the phone).
 *
 * Env:
 *   GOOGLE_CLIENT_ID       Web OAuth client ID
 *   GOOGLE_CLIENT_SECRET   Web OAuth client secret
 *   GOOGLE_REDIRECT_URI    Must match Google Cloud Console exactly
 *                          e.g. http://192.168.1.20:8787/oauth/google/callback
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_DIR = path.join(__dirname, 'mail-tokens');

const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const REDIRECT_URI = (process.env.GOOGLE_REDIRECT_URI || '').trim();

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ');

export function gmailConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

export function gmailConfigStatus() {
  return {
    configured: gmailConfigured(),
    hasClientId: Boolean(CLIENT_ID),
    hasClientSecret: Boolean(CLIENT_SECRET),
    hasRedirectUri: Boolean(REDIRECT_URI),
    redirectUri: REDIRECT_URI || null,
    scopes: SCOPES,
  };
}

function tokenPath(deviceId) {
  const safe = String(deviceId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
  if (!safe) throw new Error('Missing deviceId');
  return path.join(TOKEN_DIR, `${safe}.json`);
}

export function readTokens(deviceId) {
  try {
    const raw = fs.readFileSync(tokenPath(deviceId), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeTokens(deviceId, data) {
  fs.mkdirSync(TOKEN_DIR, { recursive: true });
  fs.writeFileSync(tokenPath(deviceId), JSON.stringify(data, null, 2));
}

export function clearTokens(deviceId) {
  try {
    fs.unlinkSync(tokenPath(deviceId));
  } catch {
    // ignore
  }
}

export function buildAuthorizeUrl(deviceId, appRedirect) {
  if (!gmailConfigured()) {
    const err = new Error('Gmail OAuth is not configured on the server');
    err.code = 'GMAIL_NOT_CONFIGURED';
    throw err;
  }
  const state = Buffer.from(
    JSON.stringify({
      deviceId: String(deviceId),
      appRedirect: appRedirect || 'lanyard://oauth/gmail',
    }),
    'utf8'
  ).toString('base64url');

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function parseOAuthState(state) {
  try {
    return JSON.parse(Buffer.from(String(state || ''), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function exchangeCode(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `Token exchange ${res.status}`);
  }
  return json;
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `Refresh ${res.status}`);
  }
  return json;
}

async function fetchUserEmail(accessToken) {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `Userinfo ${res.status}`);
  }
  return typeof json.email === 'string' ? json.email : null;
}

export async function completeOAuth(code, deviceId) {
  const tokens = await exchangeCode(code);
  const email = await fetchUserEmail(tokens.access_token);
  const existing = readTokens(deviceId);
  const next = {
    email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || existing?.refreshToken || null,
    expiry: Date.now() + (Number(tokens.expires_in) || 3600) * 1000,
    scope: tokens.scope || SCOPES,
    updatedAt: new Date().toISOString(),
  };
  if (!next.refreshToken) {
    throw new Error('Google did not return a refresh token. Disconnect in Google Account → Security → Third-party access, then connect again.');
  }
  writeTokens(deviceId, next);
  return { email, deviceId };
}

async function getValidAccessToken(deviceId) {
  const stored = readTokens(deviceId);
  if (!stored?.refreshToken) {
    const err = new Error('Gmail is not connected for this device');
    err.code = 'GMAIL_NOT_CONNECTED';
    throw err;
  }
  if (stored.accessToken && stored.expiry && Date.now() < stored.expiry - 60_000) {
    return stored.accessToken;
  }
  const refreshed = await refreshAccessToken(stored.refreshToken);
  const next = {
    ...stored,
    accessToken: refreshed.access_token,
    expiry: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000,
    updatedAt: new Date().toISOString(),
  };
  writeTokens(deviceId, next);
  return next.accessToken;
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function encodeRfc2047Subject(subject) {
  // Keep ASCII subjects plain; encode the rest so Gmail accepts UTF-8.
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

export async function sendGmailMessage({ deviceId, to, subject, body }) {
  const accessToken = await getValidAccessToken(deviceId);
  const recipient = String(to || '').trim();
  if (!recipient || !recipient.includes('@')) {
    const err = new Error('Recipient email is required');
    err.code = 'MISSING_TO';
    throw err;
  }
  const raw = [
    `To: ${recipient}`,
    `Subject: ${encodeRfc2047Subject(String(subject || '').trim() || 'Note')}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    String(body || ''),
  ].join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: toBase64Url(raw) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Gmail send ${res.status}`);
    err.code = 'GMAIL_SEND_FAILED';
    throw err;
  }
  const stored = readTokens(deviceId);
  return {
    id: json.id || null,
    from: stored?.email || null,
    to: recipient,
  };
}

export function connectionStatus(deviceId) {
  const stored = readTokens(deviceId);
  if (!stored?.refreshToken) {
    return { connected: false, email: null };
  }
  return { connected: true, email: stored.email || null };
}

export function successHtml({ email, appRedirect }) {
  const link = `${appRedirect}${appRedirect.includes('?') ? '&' : '?'}ok=1&email=${encodeURIComponent(email || '')}`;
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Gmail connected</title>
<meta http-equiv="refresh" content="0;url=${link}" />
</head><body style="font-family:system-ui;padding:2rem;max-width:28rem">
  <h1>Gmail connected</h1>
  <p>${email ? `Signed in as <strong>${email}</strong>.` : 'Signed in.'}</p>
  <p>Jumping back to Lanyard…</p>
  <p><a href="${link}">Tap here if the app didn’t open</a></p>
</body></html>`;
}

export function errorHtml(message, appRedirect) {
  const link = `${appRedirect || 'lanyard://oauth/gmail'}${
    (appRedirect || '').includes('?') ? '&' : '?'
  }ok=0&error=${encodeURIComponent(message || 'OAuth failed')}`;
  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Gmail connect failed</title></head>
<body style="font-family:system-ui;padding:2rem;max-width:28rem">
  <h1>Couldn’t connect Gmail</h1>
  <p>${message || 'Something went wrong.'}</p>
  <p><a href="${link}">Back to Lanyard</a></p>
</body></html>`;
}
