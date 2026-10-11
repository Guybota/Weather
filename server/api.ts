import {
  parseForecast,
  parseLocations,
  parseObservations,
  parseWarnings,
  parseWeatherTypes,
} from '../src/weather';

export interface ApiCache {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, ttl: number): Promise<void>;
}

export class MemoryCache implements ApiCache {
  private entries = new Map<string, { response: Response; expires: number }>();
  async get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.response.clone();
  }
  async put(key: string, response: Response, ttl: number) {
    // Bound local development memory even when many places are explored.
    if (this.entries.size >= 1024) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { response: response.clone(), expires: Date.now() + ttl * 1000 });
  }
}

export function endpoint(path: string): { url: string; ttl: number } | null {
  const routes: Record<string, [string, number]> = {
    '/api/locations': ['public-data/forecast/locations.json', 86400],
    '/api/weather-types': ['public-data/forecast/weathertypes.json', 86400],
    '/api/warnings': ['public-data/warnings/warnings_www.json', 180],
    '/api/observations': ['open-data/observation/meteorology/stations/obs-surface.geojson', 600],
  };
  const forecast = path.match(/^\/api\/forecast\/(\d{7})$/);
  const route = forecast
    ? ([`public-data/forecast/aggregate/${forecast[1]}.json`, 1200] as const)
    : routes[path];
  return route ? { url: `https://api.ipma.pt/${route[0]}`, ttl: route[1] } : null;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function handleApi(
  request: Request,
  cache: ApiCache,
  upstream: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
  const url = new URL(request.url);
  const route = endpoint(url.pathname);
  if (!route || url.search) return json({ error: 'Pedido desconhecido.' }, 404);
  const key = `https://tempo-cache.invalid${url.pathname}`;
  const fresh = await cache.get(key).catch(() => undefined);
  if (fresh) return fresh;
  try {
    const response = await upstream(route.url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`IPMA ${response.status}`);
    const body = await response.text();
    if (body.length > 5_000_000) throw new Error('Resposta demasiado grande.');
    const data: unknown = JSON.parse(body);
    if (!data || typeof data !== 'object') throw new Error('Formato inválido.');
    // Only replace last-good data after validating the endpoint's expected shape.
    if (url.pathname === '/api/locations') parseLocations(data);
    else if (url.pathname === '/api/warnings') parseWarnings(data);
    else if (url.pathname === '/api/observations') parseObservations(data);
    else if (url.pathname === '/api/weather-types') parseWeatherTypes(data);
    else parseForecast(data);
    const result = json({ data, fetchedAt: new Date().toISOString(), stale: false });
    // A separate last-good response survives the fresh TTL without claiming freshness.
    await Promise.all([
      cache.put(key, result.clone(), route.ttl),
      cache.put(`${key}/last-good`, result.clone(), 86400),
    ]).catch(() => undefined);
    return result;
  } catch {
    const lastGood = await cache.get(`${key}/last-good`).catch(() => undefined);
    if (lastGood) {
      const payload = (await lastGood.json()) as Record<string, unknown>;
      return json({ ...payload, stale: true });
    }
    return json(
      { error: 'O IPMA está temporariamente indisponível. Tenta novamente dentro de instantes.' },
      503,
    );
  }
}
