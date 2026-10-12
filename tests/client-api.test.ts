// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadData, type Envelope } from '../src/api';

const upstream = vi.fn<typeof fetch>();
const path = 'forecast/1110600';
let envelope: Envelope;

function pendingRequest(_input: unknown, options?: RequestInit): Promise<Response> {
  const signal = options?.signal;
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) reject(signal.reason);
    else signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  upstream.mockReset();
  vi.stubGlobal('fetch', upstream);
  // Reproduce a browser that has AbortController but lacks both newer static APIs.
  vi.stubGlobal(
    'AbortSignal',
    new Proxy(AbortSignal, {
      get(target, property, receiver) {
        if (property === 'any' || property === 'timeout') return undefined;
        return Reflect.get(target, property, receiver);
      },
    }),
  );
  envelope = { data: [], fetchedAt: new Date().toISOString(), stale: false };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Weather client on older Safari', () => {
  it.each([false, true])('loads and caches data with caller signal: %s', async (withSignal) => {
    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, 'removeEventListener');
    upstream.mockResolvedValue(new Response(JSON.stringify(envelope)));

    expect(AbortSignal.any).toBeUndefined();
    expect(AbortSignal.timeout).toBeUndefined();
    await expect(loadData(path, withSignal ? caller.signal : undefined)).resolves.toEqual(envelope);

    expect(upstream).toHaveBeenCalledWith(`/api/${path}`, { signal: expect.any(AbortSignal) });
    expect(JSON.parse(localStorage.getItem(`tempo:cache:${path}`)!)).toEqual(envelope);
    expect(vi.getTimerCount()).toBe(0);
    if (withSignal) expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('forwards cancellation and its reason without returning cached data', async () => {
    localStorage.setItem(`tempo:cache:${path}`, JSON.stringify(envelope));
    upstream.mockImplementation(pendingRequest);
    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, 'removeEventListener');
    const reason = new DOMException('Cancelled', 'AbortError');
    const request = loadData(path, caller.signal);
    const rejection = expect(request).rejects.toBe(reason);

    caller.abort(reason);
    await rejection;

    expect(upstream.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('honours a signal that was cancelled before loading', async () => {
    upstream.mockImplementation(pendingRequest);
    const caller = new AbortController();
    caller.abort();

    await expect(loadData(path, caller.signal)).rejects.toMatchObject({ name: 'AbortError' });

    expect(upstream.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])(
    'times out after 12 seconds with caller signal: %s',
    async (withSignal) => {
      upstream.mockImplementation(pendingRequest);
      const caller = new AbortController();
      const request = loadData(path, withSignal ? caller.signal : undefined);
      const rejection = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });

      await vi.advanceTimersByTimeAsync(11999);
      expect(upstream.mock.calls[0][1]?.signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await rejection;

      expect(caller.signal.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('keeps the timeout active while reading the response body', async () => {
    upstream.mockImplementation(
      async (_input, options) =>
        ({
          ok: true,
          json: () => pendingRequest(_input, options),
        }) as unknown as Response,
    );
    const request = loadData(path);
    const rejection = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });

    await vi.advanceTimersByTimeAsync(12000);
    await rejection;

    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns recent cached data when the request times out', async () => {
    localStorage.setItem(`tempo:cache:${path}`, JSON.stringify(envelope));
    upstream.mockImplementation(pendingRequest);
    const request = loadData(path);

    await vi.advanceTimersByTimeAsync(12000);

    await expect(request).resolves.toMatchObject({ ...envelope, stale: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects expired weather data after a timeout', async () => {
    envelope.fetchedAt = new Date(Date.now() - 86400000).toISOString();
    localStorage.setItem(`tempo:cache:${path}`, JSON.stringify(envelope));
    upstream.mockImplementation(pendingRequest);
    const request = loadData(path);
    const rejection = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });

    await vi.advanceTimersByTimeAsync(12000);
    await rejection;
  });

  it('cleans up after a network failure', async () => {
    const error = new TypeError('Network error');
    upstream.mockRejectedValue(error);
    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, 'removeEventListener');

    await expect(loadData(path, caller.signal)).rejects.toBe(error);

    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
