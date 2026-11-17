import { formatWhen } from '../format';

describe('formatWhen', () => {
  test('empty string → not yet', () => {
    expect(formatWhen('')).toBe('not yet');
  });

  test('invalid ISO returns the raw string', () => {
    expect(formatWhen('not-a-date')).toBe('not-a-date');
  });

  test('valid ISO formats to a locale string with month and day', () => {
    const out = formatWhen('2026-03-15T14:05:00.000Z');
    expect(out).toMatch(/Mar/);
    expect(out).toMatch(/15/);
  });
});
