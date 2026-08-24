import { formatDaysOfWeek, parseDaysOfWeek, WEEKDAY_KEYS } from '../weekdays';

describe('weekdays', () => {
  it('indexes days with Sunday first, matching the Loop plugin', () => {
    expect(WEEKDAY_KEYS).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
    expect(parseDaysOfWeek('sun')).toEqual([true, false, false, false, false, false, false]);
    expect(parseDaysOfWeek('mon')).toEqual([false, true, false, false, false, false, false]);
    expect(parseDaysOfWeek('sat')).toEqual([false, false, false, false, false, false, true]);
  });

  it('parses several days, full names and Russian aliases', () => {
    expect(parseDaysOfWeek('mon,wed,fri')).toEqual([false, true, false, true, false, true, false]);
    expect(parseDaysOfWeek('Monday, FRIDAY')).toEqual(parseDaysOfWeek('mon,fri'));
    expect(parseDaysOfWeek('пн,ср')).toEqual(parseDaysOfWeek('mon,wed'));
  });

  it('rejects unknown and empty day lists', () => {
    expect(() => parseDaysOfWeek('funday')).toThrow("'funday' is not a day name");
    expect(() => parseDaysOfWeek(' , ')).toThrow('expected day names');
  });

  it('formats a boolean mask back into day names', () => {
    expect(formatDaysOfWeek([false, true, false, false, false, true, false])).toEqual([
      'mon',
      'fri',
    ]);
    expect(formatDaysOfWeek([])).toEqual([]);
    expect(formatDaysOfWeek(undefined)).toEqual([]);
  });
});
