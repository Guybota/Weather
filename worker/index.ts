import { handleApi, type ApiCache } from '../server/api';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}
interface WorkerCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const edge = (caches as unknown as { default: WorkerCache }).default;
    const cache: ApiCache = {
      get: (key) => edge.match(key),
      async put(key, response, ttl) {
        const cached = new Response(response.body, response);
        cached.headers.set('Cache-Control', `public, max-age=${ttl}`);
        await edge.put(key, cached);
      },
    };
    const cachedResponse = await handleApi(request, cache);
    const response = new Response(cachedResponse.body, cachedResponse);
    // Edge cache lifetime must not become a browser-side freshness claim.
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
};
