const RELATIVE_PATTERN = /^\+(\d+)(s|m|h|d|w)$/i;
const UNIX_SECONDS_PATTERN = /^\d{10}$/;
const UNIX_MILLIS_PATTERN = /^\d{13}$/;

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

export const SCHEDULED_AT_FORMATS =
  "relative offset (+30m, +2h, +1d, +1w), ISO-8601 ('2026-08-25T09:30:00Z', '2026-08-25 09:30' in local time) or a unix timestamp in seconds/milliseconds";

/**
 * Parse a user-supplied point in time into a unix timestamp in milliseconds
 * Accepts relative offsets, ISO-8601 datetimes and unix timestamps
 * @param raw Raw option value
 * @param now Reference point for relative offsets (defaults to the current time)
 */
export function parseScheduledAt(raw: string, now: number = Date.now()): number {
  const value = raw.trim();
  if (!value) {
    throw new Error(`Invalid value for --at: expected ${SCHEDULED_AT_FORMATS}`);
  }

  let timestamp: number;
  const relative = RELATIVE_PATTERN.exec(value);

  if (relative) {
    timestamp = now + Number(relative[1]) * UNIT_MS[relative[2].toLowerCase()];
  } else if (UNIX_SECONDS_PATTERN.test(value)) {
    timestamp = Number(value) * 1000;
  } else if (UNIX_MILLIS_PATTERN.test(value)) {
    timestamp = Number(value);
  } else {
    timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      throw new Error(`Invalid value for --at: '${raw}'. Expected ${SCHEDULED_AT_FORMATS}`);
    }
  }

  if (timestamp <= now) {
    throw new Error(
      `Invalid value for --at: '${raw}' resolves to ${new Date(timestamp).toISOString()}, which is not in the future`,
    );
  }

  return timestamp;
}

const RELATIVE_PAST_PATTERN = /^-(\d+)(s|m|h|d|w)$/i;

export const PAST_MOMENT_FORMATS =
  "a relative offset into the past (-30m, -2h, -1d, -1w), ISO-8601 ('2026-08-25T09:30:00Z', '2026-08-25 09:30' in local time) or a unix timestamp in seconds/milliseconds";

/**
 * How far ahead of the local clock a moment may sit before it is treated as a mistake
 * The server's clock is not the client's — they were 162 ms apart when measured — so a
 * moment derived from server data can land slightly ahead without being wrong
 */
const FUTURE_TOLERANCE_MS = 60 * 1000;

/**
 * Parse a user-supplied moment in the past into a unix timestamp in milliseconds
 *
 * The mirror of {@link parseScheduledAt}: `-2h` rather than `+2h`, and the future is
 * what gets rejected rather than the past. A cursor set ahead of the server's clock
 * reports nothing until that moment arrives, which reads exactly like a quiet channel
 * @param raw Raw option value
 * @param flag Flag name to name in the error message
 * @param now Reference point for relative offsets (defaults to the current time)
 */
export function parsePastMoment(raw: string, flag: string, now: number = Date.now()): number {
  const value = raw.trim();
  const relative = RELATIVE_PAST_PATTERN.exec(value);

  let timestamp: number;
  if (relative) {
    timestamp = now - Number(relative[1]) * UNIT_MS[relative[2].toLowerCase()];
  } else if (UNIX_SECONDS_PATTERN.test(value)) {
    timestamp = Number(value) * 1000;
  } else {
    timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      throw new Error(`Invalid value for ${flag}: '${raw}'. Expected ${PAST_MOMENT_FORMATS}`);
    }
  }

  if (timestamp > now + FUTURE_TOLERANCE_MS) {
    throw new Error(
      `Invalid value for ${flag}: '${raw}' resolves to ${new Date(timestamp).toISOString()}, which is in the future — nothing would be reported until then`,
    );
  }

  return timestamp;
}

const DURATION_PATTERN = /^(\d+)(s|m|h|d)$/i;

export const DURATION_FORMATS = 'a duration with a unit: 30s, 5m, 2h, 1d';

/**
 * Parse a plain duration (no leading `+`, unlike `--at`) into milliseconds
 * @param raw Raw option value
 * @param flag Flag name to name in the error message
 */
export function parseDuration(raw: string, flag: string): number {
  const match = DURATION_PATTERN.exec(raw.trim());
  if (!match) {
    throw new Error(`Invalid value for ${flag}: '${raw}'. Expected ${DURATION_FORMATS}`);
  }
  const ms = Number(match[1]) * UNIT_MS[match[2].toLowerCase()];
  if (ms <= 0) {
    throw new Error(`Invalid value for ${flag}: '${raw}' is not a positive duration`);
  }
  return ms;
}

/**
 * Format a unix timestamp in milliseconds as an ISO-8601 string with the local
 * UTC offset, which is what the Loop scheduler plugin expects in `startDate`
 */
export function toIsoWithOffset(timestamp: number): string {
  const date = new Date(timestamp);
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes < 0 ? '-' : '+';
  const pad = (value: number) => String(Math.floor(Math.abs(value))).padStart(2, '0');
  const offset = `${sign}${pad(offsetMinutes / 60)}:${pad(offsetMinutes % 60)}`;

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${String(date.getMilliseconds()).padStart(3, '0')}${offset}`
  );
}
