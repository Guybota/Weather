import { describe, expect, it, vi } from 'vitest';
import { endpoint, handleApi, MemoryCache } from '../server/api';

describe('Weather API', () => {
  it('restricts paths and prevents an arbitrary upstream proxy', async () => {
    expect(endpoint('/api/forecast/1110600')?.url).toBe(
      'https://api.ipma.pt/public-data/forecast/aggregate/1110600.json',
    );
    expect(endpoint('/api/forecast/../../example.com')).toBeNull();
    const upstream = vi.fn();
    expect(
      (
        await handleApi(
          new Request('https://tempo.test/api/locations?url=https://example.com'),
          new MemoryCache(),
          upstream,
        )
      ).status,
    ).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('reuses a fresh response and marks last-good fallback as stale', async () => {
    vi.useFakeTimers();
    try {
      const cache = new MemoryCache();
      const upstream = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
        .mockRejectedValue(new Error('offline'));
      const request = new Request('https://tempo.test/api/warnings');
      const first = await handleApi(request, cache, upstream);
      const initial = await first.json();
      await handleApi(request, cache, upstream);
      expect(upstream).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(181000);
      const fallback = await (await handleApi(request, cache, upstream)).json();
      expect(fallback.stale).toBe(true);
      expect(fallback.fetchedAt).toBe(initial.fetchedAt);
      vi.advanceTimersByTime(86400000);
      expect((await handleApi(request, cache, upstream)).status).toBe(503);
    } finally {
      vi.useRealTimers();
    }
  });
  it('rejects non-JSON upstream responses and non-GET methods', async () => {
    const response = await handleApi(
      new Request('https://tempo.test/api/locations'),
      new MemoryCache(),
      vi.fn().mockResolvedValue(new Response('<html>error</html>')),
    );
    expect(response.status).toBe(503);
    expect(
      (
        await handleApi(
          new Request('https://tempo.test/api/locations', { method: 'POST' }),
          new MemoryCache(),
        )
      ).status,
    ).toBe(405);
  });
  it('preserves last-good data when JSON is valid but the endpoint schema changes', async () => {
    vi.useFakeTimers();
    try {
      const cache = new MemoryCache();
      const upstream = vi
        .fn()
        .mockResolvedValueOnce(new Response('{"data":[]}'))
        .mockResolvedValueOnce(new Response('{"items":[]}'));
      const request = new Request('https://tempo.test/api/warnings');
      await handleApi(request, cache, upstream);
      vi.advanceTimersByTime(181000);
      const fallback = await (await handleApi(request, cache, upstream)).json();
      expect(fallback.stale).toBe(true);
      expect(fallback.data).toEqual({ data: [] });
    } finally {
      vi.useRealTimers();
    }
  });
});
