import { HUDDLE_STALE_MS } from '../overnight';
import {
  freshnessCopy,
  hoursUntilStale,
  huddleAgeMs,
  huddleFreshness,
} from '../freshness';
import type { Huddle } from '../types';

const huddle = (updatedAt: string): Huddle => ({
  belief: '',
  chasing: [],
  questions: [],
  filtered: [],
  updatedAt,
});

describe('huddle freshness', () => {
  const t0 = 1_700_000_000_000;

  test('fresh → aging → stale', () => {
    const h = huddle(new Date(t0).toISOString());
    expect(huddleFreshness(h, t0 + 60_000)).toBe('fresh');
    expect(huddleFreshness(h, t0 + HUDDLE_STALE_MS * 0.8)).toBe('aging');
    expect(huddleFreshness(h, t0 + HUDDLE_STALE_MS + 1)).toBe('stale');
  });

  test('hoursUntilStale and copy', () => {
    const h = huddle(new Date(t0).toISOString());
    expect(huddleAgeMs(h, t0 + 2 * 60 * 60 * 1000)).toBe(2 * 60 * 60 * 1000);
    expect(hoursUntilStale(h, t0 + 2 * 60 * 60 * 1000)).toBe(6);
    expect(freshnessCopy(h, t0 + HUDDLE_STALE_MS * 0.8)).toContain('aging');
    expect(freshnessCopy(h, t0 + HUDDLE_STALE_MS + 1)).toContain('stale');
    expect(freshnessCopy(h, t0 + 60_000)).toContain('fresh');
  });
});
