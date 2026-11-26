const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const {
  DEFAULT_KEYWORD,
  normalizeKeywordString,
  fetchRealtimeNews,
  fetchLegislativeYuanUpdates,
} = require('./lib/fetcher');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CACHE_TTL_MS = 60 * 1000;

const cache = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function getCachedOrFetch(cacheKey, forceRefresh, fetcher) {
  const now = Date.now();
  if (!forceRefresh && cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (now - entry.createdAt < CACHE_TTL_MS) {
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
        defaultKeyword: DEFAULT_KEYWORD,
        serverTime: new Date().toISOString(),
      });
    }

    if (pathname === '/api/news') {
      const rawKw = reqUrl.searchParams.get('q') || DEFAULT_KEYWORD;
      const keyword = normalizeKeywordString(rawKw);
      const mode = reqUrl.searchParams.get('mode') === 'and' ? 'and' : 'or';
      const refresh = reqUrl.searchParams.get('refresh') === '1';
      const data = await getCachedOrFetch(`news:${mode}:${keyword}`, refresh, () =>
        fetchRealtimeNews(keyword, mode)
      );
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/ly') {
      const rawKw = reqUrl.searchParams.get('q') || DEFAULT_KEYWORD;
      const keyword = normalizeKeywordString(rawKw);
      const mode = reqUrl.searchParams.get('mode') === 'and' ? 'and' : 'or';
      const refresh = reqUrl.searchParams.get('refresh') === '1';
      const data = await getCachedOrFetch(`ly:${mode}:${keyword}`, refresh, () =>
        fetchLegislativeYuanUpdates(keyword, mode)
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
  console.log(`💧 水資源即時新聞與立法院消息監測網站已啟動！`);
  console.log(`🌐 網址: http://localhost:${PORT}`);
  console.log(`🔍 預設關鍵字: 【${DEFAULT_KEYWORD}】（支援 + 多關鍵字同時搜尋）`);
  console.log(`====================================================`);
});
