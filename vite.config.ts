import { defineConfig } from 'vite';
import path from 'path';
import type { NextHandleFunction } from 'connect';
import { searchPeople } from './server/chat/people';

const peopleSearchMiddleware = (): NextHandleFunction => async (req, res, next) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  if (url.pathname !== '/api/chat/people') return next();

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const query = (url.searchParams.get('query') || '').trim();
  console.log('[api chat people] request', { query });

  if (!query || query.length < 2) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([]));
    return;
  }

  try {
    const results = await searchPeople(query);
    console.log('[api chat people] results', { query, count: results.length });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(results));
  } catch (error) {
    console.error('[api chat people] error', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to search people' }));
  }
};

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  server: {
    allowedHosts: true,
  },
  plugins: [
    {
      name: 'people-search-api',
      configureServer(server) {
        server.middlewares.use(peopleSearchMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(peopleSearchMiddleware());
      },
    },
  ],
});
