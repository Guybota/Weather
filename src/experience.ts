import { dateInZone, formatTime, value, type Period } from './weather';

export type Indicator = 'wind' | 'humidity' | 'uv' | 'pressure' | 'rain';
export const indicatorNames: Record<Indicator, string> = {
  wind: 'Vento',
  humidity: 'Humidade',
  uv: 'Índice UV',
  pressure: 'Pressão',
  rain: 'Chuva',
};
export const defaultIndicators: Indicator[] = ['wind', 'rain', 'uv', 'humidity'];
export function validIndicators(input: unknown): Indicator[] {
  if (!Array.isArray(input)) return defaultIndicators;
  const result = [
    ...new Set(
      input.filter(
        (key): key is Indicator => typeof key === 'string' && Object.hasOwn(indicatorNames, key),
      ),
    ),
  ];
  return result.length ? result : defaultIndicators;
}
export function localHour(at: number | string, timezone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: timezone,
    }).format(new Date(at)),
  );
}
export function directionDegrees(direction: string): number | null {
  const directions: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
    O: 270,
    SO: 225,
    NO: 315,
  };
  return directions[direction.toUpperCase()] ?? null;
}
export function uvLabel(uv: number | null | undefined): string {
  return uv == null
    ? 'Sem informação'
    : uv >= 11
      ? 'Extremo'
      : uv >= 8
        ? 'Muito elevado'
        : uv >= 6
          ? 'Elevado'
          : uv >= 3
            ? 'Moderado'
            : 'Baixo';
}
export function dayInsight(
  periods: Period[],
  daily: Period | undefined,
  timezone: string,
  now: number,
): string {
  // Summarise only supplied values; never fill missing rain probabilities or expired periods.
  const today = dateInZone(now, timezone);
  const future = periods.filter(
    (p) => p.interval !== 24 && dateInZone(p.at, timezone) === today && Date.parse(p.at) >= now,
  );
  const rain = future.filter((p) => p.rain !== null);
  if (rain.length) {
    const peak = rain.reduce((a, b) => (b.rain! > a.rain! ? b : a));
    if (peak.rain! >= 40)
      return `Maior probabilidade de chuva às ${formatTime(peak.at, timezone)}: ${value(peak.rain, '%')}.`;
  }
  const wind = future.filter((p) => p.wind !== null);
  if (wind.length) {
    const peak = wind.reduce((a, b) => (b.wind! > a.wind! ? b : a));
    if (peak.wind! >= 30)
      return `Vento mais intenso às ${formatTime(peak.at, timezone)}: ${value(peak.wind, ' km/h')}.`;
  }
  if (rain.length && rain.every((p) => p.rain === 0))
    return 'Não está prevista chuva nos períodos restantes disponíveis.';
  if (rain.length)
    return `Probabilidade de chuva até ${value(Math.max(...rain.map((p) => p.rain!)), '%')} nos períodos restantes disponíveis.`;
  if (daily?.min != null && daily.max != null)
    return `Hoje, temperaturas entre ${value(daily.min, '°')} e ${value(daily.max, '°')}.`;
  return 'Consulta os períodos disponíveis para planear o teu dia.';
}
