const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const {
  DEFAULT_KEYWORD,
  parseSearchExpression,
  fetchRealtimeNews,
  fetchLegislativeYuanUpdates,
} = require('./lib/fetcher');
const { fetchGovernmentUpdates } = require('./lib/gov-fetcher');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CACHE_TTL_MS = 60 * 1000;
const GOV_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache for 20 gov agencies

const cache = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function getCachedOrFetch(cacheKey, forceRefresh, ttlMs, fetcher) {
  const now = Date.now();
  if (!forceRefresh && cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (now - entry.createdAt < ttlMs) {
      return { ...entry.data, cached: true };
    }
  }
  const freshData = await fetcher();
  cache.set(cacheKey, { createdAt: now, data: freshData });
  return { ...freshData, cached: false };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    if (pathname === '/api/health') {
      return sendJson(res, 200, {
        status: 'ok',
        siteName: '神奇海螺輿情與國會訊息即時監測網',
        defaultKeyword: DEFAULT_KEYWORD,
        serverTime: new Date().toISOString(),
      });
    }

    if (pathname === '/api/news') {
      const rawKw = reqUrl.searchParams.get('q') || DEFAULT_KEYWORD;
      const reqMode = reqUrl.searchParams.get('mode') === 'and' ? 'and' : 'or';
      const { normalized, mode } = parseSearchExpression(rawKw, reqMode);
      const refresh = reqUrl.searchParams.get('refresh') === '1';
      const data = await getCachedOrFetch(`news:${mode}:${normalized}`, refresh, CACHE_TTL_MS, () =>
        fetchRealtimeNews(normalized, mode)
      );
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/ly') {
      const rawKw = reqUrl.searchParams.get('q') || DEFAULT_KEYWORD;
      const reqMode = reqUrl.searchParams.get('mode') === 'and' ? 'and' : 'or';
      const { normalized, mode } = parseSearchExpression(rawKw, reqMode);
      const refresh = reqUrl.searchParams.get('refresh') === '1';
      const data = await getCachedOrFetch(`ly:${mode}:${normalized}`, refresh, CACHE_TTL_MS, () =>
        fetchLegislativeYuanUpdates(normalized, mode)
      );
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/gov') {
      const refresh = reqUrl.searchParams.get('refresh') === '1';
      const data = await getCachedOrFetch('gov:all', refresh, GOV_CACHE_TTL_MS, () =>
        fetchGovernmentUpdates()
      );
      return sendJson(res, 200, data);
    }

    let safePath = pathname === '/' ? '/index.html' : pathname;
    safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      });
      res.end(content);
    });
  } catch (err) {
    sendJson(res, 500, {
      error: '伺服器處理請求時發生錯誤',
      detail: err?.message || String(err),
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`====================================================`);
  console.log(`🐚 神奇海螺輿情與國會訊息即時監測網已啟動！`);
  console.log(`🌐 網址: http://localhost:${PORT}`);
  console.log(`🔍 涵蓋三大區域：即時新聞 ｜ 立法院消息 ｜ 20 個政府機關專區`);
  console.log(`====================================================`);
});
