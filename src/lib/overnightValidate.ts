import type { OvernightResult } from './overnight';
import type { Huddle, Packet } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, max);
}

function parsePacket(value: unknown, index: number, seed: number): Packet | null {
  if (!isRecord(value)) return null;
  const statusRaw = asString(value.status, 'pending');
  const status: Packet['status'] =
    statusRaw === 'approve' ||
    statusRaw === 'kill' ||
    statusRaw === 'reshape' ||
    statusRaw === 'need_human' ||
    statusRaw === 'pending'
      ? statusRaw
      : 'pending';

  const who = asString(value.who).trim();
  if (!who) return null;

  return {
    id: asString(value.id).trim() || `p-remote-${seed}-${index}`,
    who,
    why: asString(value.why, 'Fit against your goals.').trim() || 'Fit against your goals.',
    whyNow: asString(value.whyNow, 'Surfaced on the overnight pass.').trim(),
    risk: asString(value.risk, 'Medium — review optics.').trim(),
    nextStep: asString(value.nextStep, 'Approve, kill, or reshape.').trim(),
    status,
  };
}

function parseHuddle(value: unknown, nowIso: string): Huddle | null {
  if (!isRecord(value)) return null;
  const belief = asString(value.belief).trim();
  if (!belief) return null;
  return {
    belief,
    chasing: asStringArray(value.chasing, 4),
    questions: asStringArray(value.questions, 3),
    filtered: asStringArray(value.filtered, 5),
    updatedAt: asString(value.updatedAt, nowIso) || nowIso,
  };
}

/** Normalize/validate model or API JSON into OvernightResult; null if unusable. */
export function parseOvernightResult(
  raw: unknown,
  nowIso = () => new Date().toISOString(),
  idSeed = () => Date.now()
): OvernightResult | null {
  if (!isRecord(raw)) return null;
  const stamp = nowIso();
  const seed = idSeed();
  const huddle = parseHuddle(raw.huddle, stamp);
  if (!huddle) return null;

  const packetSource = Array.isArray(raw.packets) ? raw.packets : [];
  const packets = packetSource
    .map((item, index) => parsePacket(item, index, seed))
    .filter((p): p is Packet => p !== null)
    .slice(0, 4);

  if (packets.length === 0) return null;

  // Active board should be actionable — force unresolved to pending.
  const normalized = packets.map((p) =>
    p.status === 'pending' ? p : { ...p, status: 'pending' as const }
  );

  return {
    huddle: {
      ...huddle,
      chasing: huddle.chasing.length ? huddle.chasing : ['Continue the hunt carefully'],
      questions: huddle.questions.length
        ? huddle.questions
        : ['What should we correct before the next hunt?'],
      filtered: huddle.filtered.length ? huddle.filtered : ['Noise without thesis overlap'],
      updatedAt: stamp,
    },
    packets: normalized,
  };
}

export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
