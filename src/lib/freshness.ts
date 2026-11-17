import { HUDDLE_STALE_MS, isHuddleStale } from './overnight';
import type { Huddle } from './types';

export type HuddleFreshness = 'fresh' | 'aging' | 'stale';

const AGING_AFTER_MS = HUDDLE_STALE_MS * 0.75; // 6h of 8h

export function huddleAgeMs(huddle: Huddle, nowMs = Date.now()): number {
  const t = Date.parse(huddle.updatedAt);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - t);
}

export function huddleFreshness(
  huddle: Huddle,
  nowMs = Date.now()
): HuddleFreshness {
  if (isHuddleStale(huddle, nowMs)) return 'stale';
  if (huddleAgeMs(huddle, nowMs) >= AGING_AFTER_MS) return 'aging';
  return 'fresh';
}

export function hoursUntilStale(huddle: Huddle, nowMs = Date.now()): number {
  const remaining = HUDDLE_STALE_MS - huddleAgeMs(huddle, nowMs);
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / (60 * 60 * 1000));
}

export function freshnessCopy(huddle: Huddle, nowMs = Date.now()): string {
  const state = huddleFreshness(huddle, nowMs);
  if (state === 'stale') return 'Out of date — run overnight again.';
  if (state === 'aging') {
    const hours = hoursUntilStale(huddle, nowMs);
    return `Getting old — ~${hours}h until we refresh.`;
  }
  return 'Still fresh.';
}
