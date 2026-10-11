export type Envelope = { data: unknown; fetchedAt: string; stale: boolean; offline?: boolean };
function read(key: string): Envelope | null {
  try {
    const data = JSON.parse(localStorage.getItem(`tempo:cache:${key}`) ?? 'null');
    return data &&
      typeof data.fetchedAt === 'string' &&
      Number.isFinite(Date.parse(data.fetchedAt)) &&
      data.data
      ? data
      : null;
  } catch {
    return null;
  }
}
export async function loadData(path: string, signal?: AbortSignal): Promise<Envelope> {
  try {
    const response = await fetch(`/api/${path}`, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
        : AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('Não foi possível atualizar os dados do IPMA.');
    const data: Envelope = await response.json();
    if (!data.data || typeof data.fetchedAt !== 'string')
      throw new Error('Resposta inválida do IPMA.');
    try {
      localStorage.setItem(`tempo:cache:${path}`, JSON.stringify(data));
    } catch {
      /* Browsing still works without storage. */
    }
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    const cached = read(path);
    // Do not retain weather beyond 24h, but allow the slower-changing catalogue offline.
    const maxAge = path === 'locations' || path === 'weather-types' ? 30 * 86400000 : 86400000;
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < maxAge)
      return { ...cached, stale: true, offline: !navigator.onLine };
    throw error;
  }
}
