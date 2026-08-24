import { parseScheduledAt } from '../time-parser';

describe('parseScheduledAt', () => {
  const now = Date.parse('2026-08-23T12:00:00Z');

  it('parses relative offsets', () => {
    expect(parseScheduledAt('+30m', now)).toBe(now + 30 * 60 * 1000);
    expect(parseScheduledAt('+2h', now)).toBe(now + 2 * 60 * 60 * 1000);
    expect(parseScheduledAt('+1d', now)).toBe(now + 24 * 60 * 60 * 1000);
    expect(parseScheduledAt('+1w', now)).toBe(now + 7 * 24 * 60 * 60 * 1000);
    expect(parseScheduledAt('+90s', now)).toBe(now + 90 * 1000);
  });

  it('parses relative offsets case-insensitively and trims spaces', () => {
    expect(parseScheduledAt('  +2H  ', now)).toBe(now + 2 * 60 * 60 * 1000);
  });

  it('parses ISO-8601 datetimes', () => {
    expect(parseScheduledAt('2026-08-25T09:30:00Z', now)).toBe(Date.parse('2026-08-25T09:30:00Z'));
    expect(parseScheduledAt('2026-08-25T09:30:00+03:00', now)).toBe(
      Date.parse('2026-08-25T09:30:00+03:00'),
    );
  });

  it('parses unix timestamps in seconds and milliseconds', () => {
    const seconds = Math.floor(Date.parse('2026-08-25T09:30:00Z') / 1000);
    expect(parseScheduledAt(String(seconds), now)).toBe(seconds * 1000);
    expect(parseScheduledAt(String(seconds * 1000), now)).toBe(seconds * 1000);
  });

  it('rejects unparseable values', () => {
    expect(() => parseScheduledAt('tomorrow', now)).toThrow('Invalid value for --at');
    expect(() => parseScheduledAt('', now)).toThrow('Invalid value for --at');
    expect(() => parseScheduledAt('+2', now)).toThrow('Invalid value for --at');
  });

  it('rejects times that are not in the future', () => {
    expect(() => parseScheduledAt('2026-08-23T11:59:59Z', now)).toThrow('not in the future');
    expect(() => parseScheduledAt('2026-08-23T12:00:00Z', now)).toThrow('not in the future');
  });

  it('defaults the reference point to the current time', () => {
    const before = Date.now();
    const result = parseScheduledAt('+1h');
    expect(result).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
  });
});
