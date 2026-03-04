import { defineConfig } from 'vite';
import path from 'path';
import type { NextHandleFunction } from 'connect';
import { IncomingHttpHeaders } from 'http';
import { searchPeople } from './server/chat/people';
import { GET as getFriendRequests, POST as postFriendRequest } from './app/api/chat/friend-requests/route';
import { GET as getPendingFriendRequests } from './app/api/chat/friend-requests/pending/route';
import { POST as respondToFriendRequest } from './app/api/chat/friend-requests/[id]/respond/route';

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
  if (!query || query.length < 2) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([]));
    return;
  }

  try {
    const results = await searchPeople(query);
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

const buildHeaders = (rawHeaders: IncomingHttpHeaders) => {
  const headers = new Headers();
  Object.entries(rawHeaders).forEach(([key, value]) => {
    if (typeof value === 'string') {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    }
  });
  return headers;
};

const adaptAppRoute = (
  pathname: string,
  handlers: Partial<Record<'GET' | 'POST', (req: Request) => Promise<Response>>>
): NextHandleFunction => {
  return async (req, res, next) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    if (url.pathname !== pathname) return next();

    const method = (req.method || 'GET').toUpperCase() as 'GET' | 'POST';
    const handler = handlers[method];

    if (!handler) {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const body: string | undefined =
      method !== 'GET' && method !== 'HEAD'
        ? await new Promise<string | undefined>((resolve) => {
            let data = '';
            req.on('data', (chunk) => {
              data += chunk;
            });
            req.on('end', () => resolve(data || undefined));
            req.on('error', () => resolve(undefined));
          })
        : undefined;

    const headers = buildHeaders(req.headers);
    const request = new Request(url.toString(), {
      method,
      headers,
      body: body && method !== 'GET' && method !== 'HEAD' ? body : undefined,
    });

    try {
      const response = await handler(request);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      const text = await response.text();
      res.end(text);
    } catch (error) {
      console.error(`[api proxy] failed to handle ${pathname}`, error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
};

const chatFriendRequestsMiddleware = (): NextHandleFunction => adaptAppRoute('/api/chat/friend-requests', {
  GET: getFriendRequests,
  POST: postFriendRequest,
});

const pendingFriendRequestsMiddleware = (): NextHandleFunction =>
  adaptAppRoute('/api/chat/friend-requests/pending', {
    GET: getPendingFriendRequests,
  });

const respondFriendRequestMiddleware = (): NextHandleFunction => {
  return async (req, res, next) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    if (!/^\/api\/chat\/friend-requests\/.+\/respond$/.test(url.pathname)) return next();

    if ((req.method || '').toUpperCase() !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const body = await new Promise<string | undefined>((resolve) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => resolve(data || undefined));
      req.on('error', () => resolve(undefined));
    });

    const request = new Request(url.toString(), {
      method: 'POST',
      headers: buildHeaders(req.headers),
      body,
    });

    try {
      const response = await respondToFriendRequest(request);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      const text = await response.text();
      res.end(text);
    } catch (error) {
      console.error('[api proxy] failed to handle friend request response', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
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
    {
      name: 'chat-friend-requests-api',
      configureServer(server) {
        server.middlewares.use(chatFriendRequestsMiddleware());
        server.middlewares.use(pendingFriendRequestsMiddleware());
        server.middlewares.use(respondFriendRequestMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(chatFriendRequestsMiddleware());
        server.middlewares.use(pendingFriendRequestsMiddleware());
        server.middlewares.use(respondFriendRequestMiddleware());
      },
    },
  ],
});
