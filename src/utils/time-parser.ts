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
