// scripts/warmup-dev.mjs
/* Warm up (compile) all Next.js routes by requesting them once.
 */
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import fg from "fast-glob";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "app");
const PAGES_DIR = path.join(ROOT, "pages");

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "127.0.0.1";
const BASE = process.env.WARMUP_BASE || `http://${HOST}:${PORT}`;

const MAX_CONCURRENCY = Number(process.env.WARMUP_CONCURRENCY || 6);
const WARMUP_SKIP_MESSAGES = process.env.WARMUP_SKIP_MESSAGES === "1";

// optional: if you need auth cookies to reach protected endpoints
// set WARMUP_COOKIE="name=value; name2=value2"
const COOKIE_HEADER = process.env.WARMUP_COOKIE || process.env.COOKIE_HEADER || "";
const CHAT_SERVER_FILE = path.join(ROOT, "server", "chat", "server.ts");
const API_PATH_ALIASES = {
  "/api/chat/friend-requests": "/api/friend-requests",
  "/api/chat/friend-requests/1/respond": "/api/friend-requests/1/respond",
  "/api/rooms/direct": "/api/rooms/direct",
};

/** Wait until the dev server is listening on PORT. */
function waitForPort(port, host, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function tryOnce() {
      const socket = net.connect({ port, host }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
        } else {
          setTimeout(tryOnce, 300);
        }
      });
    })();
  });
}

/** Convert a filesystem segment to a URL piece. */
function normalizeSegment(seg) {
  // remove route groups: (marketing)
  if (/^\(.*\)$/.test(seg)) return "";
  // parallel/slot routes like @modal -> ignore in path discovery
  if (/^@.*/.test(seg)) return "";
  // dynamic segments: [id], [slug], [locale], etc.
  const dyn = seg.match(/^\[(.*)\]$/);
  if (dyn) {
    const name = dyn[1];
    // catch-all [...slug] / optional [[...slug]]
    if (name.startsWith("...")) return "warm";
    if (name.startsWith("[...")) return "warm";
    if (name.startsWith("[[")) return ""; // optional segment -> skip
    // deterministic placeholders
    const map = { id: "1", slug: "warm", locale: "en", userId: "1" };
    return map[name] || "warm";
  }
  return seg;
}

/** Build URL path from an app/ path like app/admin/ccas/page.tsx */
function toAppRoute(filePath) {
  const rel = path.relative(APP_DIR, filePath);
  // API route file?
  if (rel.startsWith(`api${path.sep}`) && /(?:^|\/)route\.(ts|js)$/.test(rel)) {
    const segs = rel.replace(/\\/g, "/").split("/");
    segs.pop(); // route.ts
    return "/api/" + segs.slice(1).map(normalizeSegment).filter(Boolean).join("/");
  }
  // page.* files -> pages
  if (/\/page\.(tsx|jsx|js|mdx?)$/.test(rel.replace(/\\/g, "/"))) {
    const segs = rel.replace(/\\/g, "/").split("/");
    segs.pop(); // page.ext
    const parts = segs.map(normalizeSegment).filter(Boolean);
    const url = "/" + parts.join("/");
    return url === "/index" ? "/" : url;
  }
  return null;
}

/** Build URL path from a pages/ path like pages/admin/ccas.tsx */
function toPagesRoute(filePath) {
  const rel = path.relative(PAGES_DIR, filePath).replace(/\\/g, "/");
  if (rel.startsWith("api/")) {
    const withNoExt = rel.replace(/\.(tsx|jsx|js|ts)$/, "");
    return "/" + withNoExt.split("/").map(normalizeSegment).filter(Boolean).join("/");
  }
  // ignore _app, _document, _error, 404
  if (/^(_app|_document|_error|404)\.(js|jsx|tsx)$/.test(path.basename(rel))) return null;
  const noExt = rel.replace(/\.(tsx|jsx|js|mdx?)$/, "");
  const segs = noExt.split("/");
  const parts = segs.map(normalizeSegment).filter(Boolean);
  let url = "/" + parts.join("/");
  if (url.endsWith("/index")) url = url.slice(0, -"/index".length) || "/";
  return url;
}

/** Discover routes from filesystem. */
async function discoverRoutes() {
  const urls = new Set();

  if (fs.existsSync(APP_DIR)) {
    const appFiles = await fg(
      [
        "app/**/page.{ts,tsx,js,jsx,md,mdx}",
        "app/api/**/route.ts",
        "app/api/**/route.js",
      ],
      { cwd: ROOT, dot: false }
    );
    for (const f of appFiles) {
      const full = path.join(ROOT, f);
      const url = toAppRoute(full);
      if (url) urls.add(url);
    }
  }

  if (fs.existsSync(PAGES_DIR)) {
    const pageFiles = await fg(
      [
        "pages/**/*.{ts,tsx,js,jsx,md,mdx}",
        "!pages/**/_*.{ts,tsx,js,jsx}",
        "!pages/**/components/**",
        "!pages/**/.*",
      ],
      { cwd: ROOT, dot: false }
    );
    for (const f of pageFiles) {
      const full = path.join(ROOT, f);
      const url = toPagesRoute(full);
      if (url) urls.add(url);
    }
  }

  // Always ensure "/" exists if there is any UI
  urls.add("/");

  return Array.from(urls).sort((a, b) => a.localeCompare(b));
}

function discoverExpressApiRoutes() {
  if (!fs.existsSync(CHAT_SERVER_FILE)) return [];
  const source = fs.readFileSync(CHAT_SERVER_FILE, "utf8");
  const routes = [];
  const routeRegex = /app\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]\s*,([^\n]*)/g;

  for (const match of source.matchAll(routeRegex)) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const args = match[3] || '';
    if (!routePath.startsWith("/api/")) continue;

    const warmPath = routePath.replace(/:([A-Za-z_][\w-]*)/g, (_m, name) => {
      const map = { id: "1", roomId: "1", userId: "1" };
      return map[name] || "1";
    });

    routes.push({
      path: API_PATH_ALIASES[warmPath] || warmPath,
      method,
      protected: /\brequireAuth\b/.test(args),
    });
  }

  const deduped = new Map();
  for (const route of routes) {
    deduped.set(`${route.method} ${route.path}`, route);
  }
  return Array.from(deduped.values()).sort((a, b) => a.path.localeCompare(b.path));
}

/** Simple promise pool */
async function runPool(items, limit, worker) {
  const results = [];
  let i = 0;
  let active = 0;
  return await new Promise((resolve) => {
    const next = () => {
      while (active < limit && i < items.length) {
        const idx = i++;
        active++;
        worker(items[idx])
          .then((r) => (results[idx] = r))
          .catch((e) => (results[idx] = { error: e?.message || String(e) }))
          .finally(() => {
            active--;
            if (results.length === items.length) resolve(results);
            else next();
          });
      }
    };
    next();
  });
}

(async () => {
  const routes = await discoverRoutes();
  const filteredRoutes = WARMUP_SKIP_MESSAGES ? routes.filter((route) => route !== "/messages") : routes;
  const expressApiRoutes = discoverExpressApiRoutes();

  console.log(`[warmup] Discovered ${filteredRoutes.length} route(s).`);
  if (WARMUP_SKIP_MESSAGES) {
    console.log("[warmup] Skipping /messages because WARMUP_SKIP_MESSAGES=1");
  }
  filteredRoutes.forEach((r) => console.log(" •", r));

  console.log(`[warmup] Waiting for ${HOST}:${PORT} ...`);
  await waitForPort(PORT, HOST);
  console.log(`[warmup] Server detected at ${BASE}`);

  const headers = {};
  if (COOKIE_HEADER) headers["cookie"] = COOKIE_HEADER;

  const apiRoutes = filteredRoutes.filter((r) => r.startsWith("/api/"));
  const pageRoutes = filteredRoutes.filter((r) => !r.startsWith("/api/"));
  const hasExpressRoutes = expressApiRoutes.length > 0;

  if (hasExpressRoutes) {
    console.log(`[warmup] Using ${expressApiRoutes.length} Express API route(s) discovered from server/chat/server.ts`);
  }

  const apiHits = (hasExpressRoutes
    ? expressApiRoutes
    : apiRoutes.map((r) => ({ path: r, method: "GET", protected: false }))
  ).filter((route) => {
    if (!route.protected || COOKIE_HEADER) return true;
    console.log(`[warmup] Skipping protected route without cookie: ${route.method} ${route.path}`);
    return false;
  });

  // hit pages first (GET), then APIs with discovered method
  const hits = [
    ...pageRoutes.map((r) => ({ url: new URL(r, BASE).toString(), method: "GET" })),
    ...apiHits.map((r) => ({ url: new URL(r.path, BASE).toString(), method: r.method })),
  ];

  const started = Date.now();

  const results = await runPool(hits, MAX_CONCURRENCY, async ({ url, method }) => {
    try {
      const res = await fetch(url, { method, headers });
      return { url, status: res.status, ok: res.ok, method };
    } catch (e) {
      // Network error (connection refused during boot, etc.)
      return { url, status: 0, ok: false, method, error: e?.message || String(e) };
    }
  });

  const took = ((Date.now() - started) / 1000).toFixed(1);
  const ok = results.filter((r) => r.ok).length;
  console.log(`[warmup] Done in ${took}s — ${ok}/${results.length} successful.`);

  const failures = results.filter((r) => !r.ok);
  if (failures.length) {
    console.log(`[warmup] Non-2xx responses (often expected for protected/admin/API):`);
    failures.forEach((f) =>
      console.log(`   ${f.method} ${f.url} -> ${f.status || f.error}`)
    );
  }
})();
