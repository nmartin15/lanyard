#!/usr/bin/env node
/**
 * Thin overnight + morning-brief + Gmail OAuth/send API for Lanyard.
 *
 * POST /overnight  { intake, team, packets, corpus, packetArchive? }
 * POST /brief      { huddle, packets, dialogue?, to?, send? }
 * GET  /oauth/google/start?deviceId=&appRedirect=
 * GET  /oauth/google/callback?code=&state=
 * GET  /oauth/google/status?deviceId=
 * DELETE /oauth/google?deviceId=
 * POST /outreach/send { deviceId, to, subject, body }
 *
 * Env: see .env.example
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { briefToEmailPayload, buildMorningBrief } from './brief.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTBOX = path.join(__dirname, 'outbox');

/** Load repo-root .env into process.env (no dependency). Does not override existing vars. */
function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // no .env — fine
  }
}

loadDotEnv();

// Import after .env so GOOGLE_* are visible to gmail.mjs module init.
const gmail = await import('./gmail.mjs');

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const KEY = process.env.OPENAI_API_KEY || '';
const BRIEF_TO = (process.env.BRIEF_TO || '').trim() || null;
const RESEND_KEY = (process.env.RESEND_API_KEY || '').trim();

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, DELETE',
  });
  res.end(payload);
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parseUrl(req) {
  return new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
}

function buildPrompt(input) {
  return `You are the overnight research + outreach team for Lanyard — private, careful, no spam, no feed.
You scout external relationship candidates (not people the user already named), research them, and draft sample outreach for human approve-before-send.
Return ONLY valid JSON with this shape:
{
  "huddle": {
    "belief": "string",
    "chasing": ["string"],
    "questions": ["string"],
    "filtered": ["string"],
    "updatedAt": "ISO-8601"
  },
  "packets": [
    {
      "id": "string",
      "who": "string",
      "why": "string",
      "whyNow": "string",
      "risk": "string",
      "nextStep": "string",
      "sourceHint": "string",
      "research": "string",
      "approach": "string",
      "outreach": { "to": "string", "subject": "string", "body": "string" },
      "status": "pending"
    }
  ]
}
Rules:
- 2-4 pending packets max. Include at least one strong fit and one likely kill/noise.
- Every packet needs research, approach, and a short sample outreach (noise packets: subject "(do not send)", to "").
- outreach.to may be "" when the real address is unknown — the human will type it before send.
- Candidates are external leads from ecosystem scans — not the user's existing contacts.
- Respect anti-goals, neverMessageAsMe, respect list, and interrupt policy.
- Use team seat mandates. Warm, specific notes over cold spray.
- Questions should be concrete and answerable on a walk.
- filtered proves silence outward (noise you blocked).
- Keep who/why scannable for a phone; put depth in research/approach/outreach.

INPUT:
${JSON.stringify(input, null, 2)}`;
}

async function callModel(input) {
  if (!KEY) {
    const err = new Error('OPENAI_API_KEY is not set');
    err.code = 'NO_KEY';
    throw err;
  }
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You produce structured overnight hunt JSON for a private advocacy mobile app. No markdown.',
        },
        { role: 'user', content: buildPrompt(input) },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Model error ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Empty model content');
  }
  return JSON.parse(content);
}

async function deliverEmail(email) {
  if (!email.to) {
    return { status: 'skipped', error: 'No recipient (set BRIEF_TO or pass to)' };
  }

  if (RESEND_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.BRIEF_FROM || 'Lanyard <onboarding@resend.dev>',
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        status: 'failed',
        error: json?.message || `Resend ${res.status}`,
      };
    }
    return { status: 'sent', id: json?.id || null };
  }

  fs.mkdirSync(OUTBOX, { recursive: true });
  const file = path.join(OUTBOX, `${Date.now()}-${email.brief.id}.json`);
  fs.writeFileSync(file, JSON.stringify(email, null, 2));
  return { status: 'queued', path: file };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  const url = parseUrl(req);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      llm: Boolean(KEY),
      model: MODEL,
      briefTo: BRIEF_TO,
      email: RESEND_KEY ? 'resend' : 'outbox',
      gmail: gmail.gmailConfigStatus(),
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/oauth/google/start') {
    try {
      const deviceId = url.searchParams.get('deviceId');
      const appRedirect = url.searchParams.get('appRedirect') || 'lanyard://oauth/gmail';
      if (!deviceId) {
        sendHtml(res, 400, gmail.errorHtml('Missing deviceId', appRedirect));
        return;
      }
      const authorizeUrl = gmail.buildAuthorizeUrl(deviceId, appRedirect);
      res.writeHead(302, { Location: authorizeUrl });
      res.end();
    } catch (err) {
      sendHtml(
        res,
        503,
        gmail.errorHtml(err?.message || 'Gmail OAuth not configured', 'lanyard://oauth/gmail')
      );
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/oauth/google/callback') {
    const code = url.searchParams.get('code');
    const state = gmail.parseOAuthState(url.searchParams.get('state'));
    const appRedirect = state?.appRedirect || 'lanyard://oauth/gmail';
    const deviceId = state?.deviceId;
    const oauthError = url.searchParams.get('error');
    if (oauthError) {
      sendHtml(res, 400, gmail.errorHtml(oauthError, appRedirect));
      return;
    }
    if (!code || !deviceId) {
      sendHtml(res, 400, gmail.errorHtml('Missing code or deviceId', appRedirect));
      return;
    }
    try {
      const result = await gmail.completeOAuth(code, deviceId);
      sendHtml(res, 200, gmail.successHtml({ email: result.email, appRedirect }));
    } catch (err) {
      sendHtml(res, 502, gmail.errorHtml(err?.message || 'OAuth failed', appRedirect));
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/oauth/google/status') {
    const deviceId = url.searchParams.get('deviceId');
    if (!deviceId) {
      sendJson(res, 400, { error: 'Missing deviceId' });
      return;
    }
    sendJson(res, 200, {
      ...gmail.connectionStatus(deviceId),
      configured: gmail.gmailConfigured(),
    });
    return;
  }

  if (req.method === 'DELETE' && url.pathname === '/oauth/google') {
    const deviceId = url.searchParams.get('deviceId');
    if (!deviceId) {
      sendJson(res, 400, { error: 'Missing deviceId' });
      return;
    }
    gmail.clearTokens(deviceId);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/outreach/send') {
    try {
      const body = await readBody(req);
      const result = await gmail.sendGmailMessage({
        deviceId: body.deviceId,
        to: body.to,
        subject: body.subject,
        body: body.body,
      });
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      const status =
        err?.code === 'GMAIL_NOT_CONNECTED'
          ? 401
          : err?.code === 'MISSING_TO'
            ? 400
            : err?.code === 'GMAIL_NOT_CONFIGURED'
              ? 503
              : 502;
      sendJson(res, status, {
        ok: false,
        error: err?.message || 'Send failed',
        code: err?.code || 'SEND_FAILED',
      });
    }
    return;
  }

  if (req.method === 'POST' && (url.pathname === '/overnight')) {
    try {
      const input = await readBody(req);
      const result = await callModel(input);
      const brief = buildMorningBrief({
        huddle: result.huddle,
        packets: result.packets,
        dialogue: [],
      });
      sendJson(res, 200, { ...result, brief });
    } catch (err) {
      const status = err?.code === 'NO_KEY' ? 503 : 502;
      sendJson(res, status, {
        error: err?.message || 'Overnight failed',
        code: err?.code || 'OVERNIGHT_FAILED',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/brief') {
    try {
      const body = await readBody(req);
      const brief = buildMorningBrief({
        huddle: body.huddle,
        packets: body.packets,
        dialogue: body.dialogue,
      });
      const to = (typeof body.to === 'string' && body.to.trim()) || BRIEF_TO;
      const email = briefToEmailPayload(brief, to);
      const shouldSend = body.send !== false;
      const delivery = shouldSend
        ? await deliverEmail(email)
        : { status: 'preview', error: null };
      sendJson(res, 200, { brief, email: { to: email.to, subject: email.subject }, delivery });
    } catch (err) {
      sendJson(res, 502, {
        error: err?.message || 'Brief failed',
        code: 'BRIEF_FAILED',
      });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Lanyard overnight server on http://0.0.0.0:${PORT}`);
  console.log(`LLM: ${KEY ? `enabled (${MODEL})` : 'disabled — set OPENAI_API_KEY'}`);
  console.log(
    `Brief email: ${RESEND_KEY ? 'Resend' : 'outbox file'} · default to: ${BRIEF_TO || '(none)'}`
  );
  const g = gmail.gmailConfigStatus();
  console.log(
    g.configured
      ? `Gmail OAuth: ready · redirect ${g.redirectUri}`
      : 'Gmail OAuth: not configured — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI'
  );
});
