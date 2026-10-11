import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { handleApi, MemoryCache } from './server/api';
import type { IncomingMessage, ServerResponse } from 'node:http';

function localApi(): Plugin {
  const cache = new MemoryCache();
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/')) return next();
    try {
      const response = await handleApi(
        new Request(`http://localhost${req.url}`, { method: req.method }),
        cache,
      );
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(await response.text());
    } catch {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'Não foi possível contactar o IPMA.' }));
    }
  };
  return {
    name: 'ipma-local-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    localApi(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'ipma.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tempo — Meteorologia em Portugal',
        short_name: 'Tempo',
        description: 'Previsões e avisos do IPMA, com uma leitura mais clara.',
        lang: 'pt-PT',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#eef4f7',
        theme_color: '#17364b',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
