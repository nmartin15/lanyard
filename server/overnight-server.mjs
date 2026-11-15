#!/usr/bin/env node
/**
 * Thin overnight API for Lanyard.
 * POST /overnight  { intake, team, packets, corpus, packetArchive? }
 * -> { huddle, packets }
 *
 * Env:
 *   OPENAI_API_KEY   required for LLM mode
 *   OPENAI_BASE_URL  optional (default https://api.openai.com/v1)
 *   OPENAI_MODEL     optional (default gpt-4o-mini)
 *   PORT             optional (default 8787)
 */
import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const KEY = process.env.OPENAI_API_KEY || '';

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  });
  res.end(payload);
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

function buildPrompt(input) {
  return `You are the overnight advocacy team for Lanyard — private, careful, no spam, no feed.
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
      "status": "pending"
    }
  ]
}
Rules:
- 2-4 pending packets max. Include at least one strong fit and one likely kill/noise.
- Respect anti-goals, neverMessageAsMe, respect list, and interrupt policy.
- Use team seat mandates. Warm paths over cold spray.
- Questions should be concrete and answerable on a walk.
- filtered proves silence outward (noise you blocked).

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

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true, llm: Boolean(KEY), model: MODEL });
    return;
  }
  if (req.method === 'POST' && (req.url === '/overnight' || req.url?.startsWith('/overnight?'))) {
    try {
      const input = await readBody(req);
      const result = await callModel(input);
      send(res, 200, result);
    } catch (err) {
      const status = err?.code === 'NO_KEY' ? 503 : 502;
      send(res, status, {
        error: err?.message || 'Overnight failed',
        code: err?.code || 'OVERNIGHT_FAILED',
      });
    }
    return;
  }
  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Lanyard overnight server on http://localhost:${PORT}`);
  console.log(`LLM: ${KEY ? `enabled (${MODEL})` : 'disabled — set OPENAI_API_KEY'}`);
});
