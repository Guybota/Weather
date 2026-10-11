import { locale } from './i18n';

export type Location = {
  id: number;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  region: number;
  timezone: string;
};
export type Period = {
  at: string;
  date: string;
  interval: 1 | 3 | 24;
  updated: string;
  temperature: number | null;
  min: number | null;
  max: number | null;
  rain: number | null;
  humidity: number | null;
  wind: number | null;
  direction: string;
  uv: number | null;
  weather: number;
};
export type Warning = {
  area: string;
  level: string;
  type: string;
  text: string;
  start: string;
  end: string;
};
export type Observation = {
  name: string;
  at: string;
  latitude: number;
  longitude: number;
  temperature: number | null;
  humidity: number | null;
  wind: number | null;
  pressure: number | null;
};
export type WeatherType = { id: number; description: string; englishDescription?: string };
type Row = Record<string, unknown>;

export function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const n = Number(value);
  return Number.isFinite(n) && n !== -99 ? n : null;
}
export function utc(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)) return '';
  const input = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  const date = new Date(input);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}
function rows(data: unknown): Row[] {
  if (!Array.isArray(data)) throw new Error('O formato dos dados do IPMA mudou.');
  return data.filter((row): row is Row => !!row && typeof row === 'object' && !Array.isArray(row));
}
export function parseLocations(data: unknown): Location[] {
  const locations = rows(data).flatMap((row) => {
    const id = numeric(row.globalIdLocal),
      latitude = numeric(row.latitude),
      longitude = numeric(row.longitude);
    if (
      id === null ||
      !Number.isInteger(id) ||
      latitude === null ||
      longitude === null ||
      typeof row.local !== 'string'
    )
      return [];
    const region = Number(row.idRegiao);
    return [
      {
        id,
        name: row.local,
        area: String(row.idAreaAviso ?? ''),
        latitude,
        longitude,
        region,
        timezone: region === 3 ? 'Atlantic/Azores' : 'Europe/Lisbon',
      },
    ];
  });
  if (!locations.length) throw new Error('O catálogo de localidades está indisponível.');
  return locations.sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}
export function parseForecast(data: unknown): Period[] {
  const result = rows(data).flatMap((row) => {
    const interval = Number(row.idPeriodo);
    const at = utc(row.dataPrev);
    if (![1, 3, 24].includes(interval) || !at) return [];
    return [
      {
        at,
        date: String(row.dataPrev).slice(0, 10),
        interval: interval as 1 | 3 | 24,
        updated: utc(row.dataUpdate),
        temperature: numeric(row.tMed),
        min: numeric(row.tMin),
        max: numeric(row.tMax),
        rain: numeric(row.probabilidadePrecipita),
        humidity: numeric(row.hR),
        wind: numeric(row.ffVento),
        direction: String(row.ddVento ?? ''),
        uv: numeric(row.iUv),
        weather: numeric(row.idTipoTempo) ?? 0,
      },
    ];
  });
  if (!result.some((row) => row.interval === 24))
    throw new Error('A previsão diária está indisponível.');
  return result.sort((a, b) => a.at.localeCompare(b.at));
}
export function parseWarnings(data: unknown): Warning[] {
  if (!data || typeof data !== 'object') throw new Error('Avisos indisponíveis.');
  return rows((data as Row).data).flatMap((row) => {
    const start = utc(row.startTime),
      end = utc(row.endTime);
    if (!start || !end || !['yellow', 'orange', 'red'].includes(String(row.awarenessLevelID)))
      return [];
    return [
      {
        area: String(row.idAreaAviso),
        level: String(row.awarenessLevelID),
        type: String(row.awarenessTypeName),
        text: String(row.text ?? ''),
        start,
        end,
      },
    ];
  });
}
export function relevantWarnings(warnings: Warning[], area: string, now: number): Warning[] {
  const ranks: Record<string, number> = { red: 3, orange: 2, yellow: 1 };
  return warnings
    .filter((w) => w.area === area && Date.parse(w.end) > now)
    .sort((a, b) => ranks[b.level] - ranks[a.level] || a.start.localeCompare(b.start));
}
export function parseWeatherTypes(data: unknown): WeatherType[] {
  return rows(data).map((row) => ({
    id: Number(row.idTipoTempo),
    description: String(row.descTipoTempoPT ?? 'Sem informação'),
    englishDescription:
      typeof row.descTipoTempoEN === 'string' ? row.descTipoTempoEN.trim() : undefined,
  }));
}
export function parseObservations(data: unknown): Observation[] {
  if (!data || typeof data !== 'object') throw new Error('Observações indisponíveis.');
  return rows((data as Row).features).flatMap((feature) => {
    const properties = feature.properties as Row | undefined,
      geometry = feature.geometry as Row | undefined;
    const coords = geometry?.coordinates;
    if (!properties || !Array.isArray(coords) || !utc(properties.time)) return [];
    const latitude = numeric(coords[1]),
      longitude = numeric(coords[0]);
    if (latitude === null || longitude === null) return [];
    return [
      {
        name: String(properties.localEstacao),
        at: utc(properties.time),
        latitude,
        longitude,
        temperature: numeric(properties.temperatura),
        humidity: numeric(properties.humidade),
        wind: numeric(properties.intensidadeVentoKM),
        pressure: numeric(properties.pressao),
      },
    ];
  });
}
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = Math.PI / 180;
  const p =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p));
}
export function nearestObservation(
  data: Observation[],
  location: Location,
  now: number,
): (Observation & { distance: number }) | null {
  const candidates = data
    .filter(
      (o) =>
        o.temperature !== null &&
        now - Date.parse(o.at) <= 3 * 3600000 &&
        Date.parse(o.at) <= now + 600000,
    )
    .map((o) => ({ ...o, distance: distanceKm(o, location) }))
    .filter((o) => o.distance <= 50)
    .sort((a, b) => a.distance - b.distance || b.at.localeCompare(a.at));
  return candidates[0] ?? null;
}
export function dateInZone(at: string | number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(at));
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}-${parts.find((p) => p.type === 'day')!.value}`;
}
export function formatTime(at: string | number, timezone: string): string {
  return new Intl.DateTimeFormat(locale(), {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(at));
}
export function formatDay(
  date: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short' },
): string {
  // Daily forecast dates are calendar labels, not instants to shift into the previous Azores day.
  return new Intl.DateTimeFormat(locale(), { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
export function value(n: number | null | undefined, suffix = '', digits = 0): string {
  return n === null || n === undefined
    ? '—'
    : `${n.toLocaleString(locale(), { maximumFractionDigits: digits })}${suffix}`;
}
