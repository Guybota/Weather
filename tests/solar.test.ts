import { expect, it } from 'vitest';
import { solarEvents } from '../src/solar';
import { dateInZone, formatTime, type Location } from '../src/weather';

const lisbon: Location = {
  id: 1110600,
  name: 'Lisboa',
  area: 'LSB',
  region: 1,
  latitude: 38.7223,
  longitude: -9.1393,
  timezone: 'Europe/Lisbon',
};

it('calculates a longer summer day and a shorter winter day at Lisboa', () => {
  const summer = solarEvents('2026-06-21', lisbon);
  const winter = solarEvents('2026-12-21', lisbon);
  expect(summer.map((event) => event.kind)).toEqual(['sunrise', 'sunset']);
  expect(formatTime(summer[0].at, lisbon.timezone)).toMatch(/^06:/);
  expect(formatTime(summer[1].at, lisbon.timezone)).toMatch(/^21:/);
  expect(formatTime(winter[0].at, lisbon.timezone)).toMatch(/^07:/);
  expect(formatTime(winter[1].at, lisbon.timezone)).toMatch(/^17:/);
  const daylight = (events: typeof summer) => Date.parse(events[1].at) - Date.parse(events[0].at);
  expect(daylight(summer)).toBeGreaterThan(14 * 3600000);
  expect(daylight(winter)).toBeLessThan(10 * 3600000);
});

it('keeps the selected Azores day and formats summer/winter clock changes locally', () => {
  const azores = { ...lisbon, latitude: 37.741, longitude: -25.676, timezone: 'Atlantic/Azores' };
  for (const date of ['2026-03-28', '2026-03-29', '2026-10-24', '2026-10-25']) {
    const events = solarEvents(date, azores);
    expect(events).toHaveLength(2);
    expect(events.every((event) => dateInZone(event.at, azores.timezone) === date)).toBe(true);
    const utc = new Date(events[0].at).getUTCHours();
    const local = Number(formatTime(events[0].at, azores.timezone).slice(0, 2));
    expect(local).toBe(utc + (date === '2026-03-28' || date === '2026-10-25' ? -1 : 0));
  }
});

it('omits solar times when a place or date is invalid, or the sun does not rise/set', () => {
  expect(solarEvents('2026-06-21', undefined)).toEqual([]);
  expect(solarEvents('2026-02-30', lisbon)).toEqual([]);
  expect(solarEvents('invalid', lisbon)).toEqual([]);
  expect(solarEvents('2026-06-21', { ...lisbon, latitude: NaN })).toEqual([]);
  expect(solarEvents('2026-06-21', { ...lisbon, latitude: 89, longitude: 0 })).toEqual([]);
});
