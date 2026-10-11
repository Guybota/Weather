import { getTimes } from 'suncalc';
import { dateInZone, type Location } from './weather';

export type SolarEvent = { kind: 'sunrise' | 'sunset'; at: string };

export function solarEvents(date: string, location: Location | undefined): SolarEvent[] {
  if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    Math.abs(location.latitude) > 90 ||
    Math.abs(location.longitude) > 180 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    return [];
  // A calendar date at UTC noon stays on that date throughout Portugal,
  // independently of the device's timezone and summer/winter clock changes.
  const noon = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(noon.getTime()) || dateInZone(noon.getTime(), location.timezone) !== date)
    return [];
  const times = getTimes(noon, location.latitude, location.longitude);
  return (['sunrise', 'sunset'] as const).flatMap((kind) => {
    const time = times[kind];
    if (
      !time ||
      !Number.isFinite(time.getTime()) ||
      dateInZone(time.getTime(), location.timezone) !== date
    )
      return [];
    return [{ kind, at: time.toISOString() }];
  });
}
