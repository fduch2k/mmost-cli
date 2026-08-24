/**
 * The Loop scheduler plugin indexes `daysOfWeek` with Sunday first, matching the
 * plugin bundle's own day list (`[{id:1,"ПН"},…,{id:0,"ВС"}]`), even though its
 * UI renders the checkboxes starting from Monday
 */
const WEEKDAYS = [
  { key: 'sun', aliases: ['sun', 'sunday', 'вс', 'воскресенье'] },
  { key: 'mon', aliases: ['mon', 'monday', 'пн', 'понедельник'] },
  { key: 'tue', aliases: ['tue', 'tuesday', 'вт', 'вторник'] },
  { key: 'wed', aliases: ['wed', 'wednesday', 'ср', 'среда'] },
  { key: 'thu', aliases: ['thu', 'thursday', 'чт', 'четверг'] },
  { key: 'fri', aliases: ['fri', 'friday', 'пт', 'пятница'] },
  { key: 'sat', aliases: ['sat', 'saturday', 'сб', 'суббота'] },
];

export const WEEKDAY_KEYS = WEEKDAYS.map(day => day.key);

/**
 * Parse a comma-separated day list into the plugin's seven-slot boolean array
 * @param value Day names, e.g. `mon,wed,fri`
 */
export function parseDaysOfWeek(value: string): boolean[] {
  const days = new Array(7).fill(false) as boolean[];
  const parts = value
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error(`Invalid value for --days: expected day names (${WEEKDAY_KEYS.join(', ')})`);
  }

  for (const part of parts) {
    const index = WEEKDAYS.findIndex(day => day.aliases.includes(part));
    if (index === -1) {
      throw new Error(
        `Invalid value for --days: '${part}' is not a day name (${WEEKDAY_KEYS.join(', ')})`,
      );
    }
    days[index] = true;
  }

  return days;
}

/**
 * Turn the plugin's boolean array back into day names for readable output
 */
export function formatDaysOfWeek(days: unknown): string[] {
  if (!Array.isArray(days)) {
    return [];
  }
  return WEEKDAY_KEYS.filter((_, index) => days[index] === true);
}
