const DEFAULT_KEYWORD = '水資源';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json, application/rss+xml, application/xml, text/xml, text/html, */*',
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
};

function decodeHtmlEntities(str = '') {
  if (!str) return '';
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripHtml(str = '') {
  return decodeHtmlEntities(str)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse user search input supporting:
 * - '+' / '＋' / '、' / ',' separators (uses explicit fallbackMode)
 * - inline boolean 'OR' / '|' / '｜' (overrides mode to 'or')
 * - inline boolean 'AND' / '&' (overrides mode to 'and')
 */
function parseSearchExpression(rawInput = DEFAULT_KEYWORD, fallbackMode = 'or') {
  let detectedMode = fallbackMode === 'and' ? 'and' : 'or';
  let s = String(rawInput || '').trim();
  if (!s) {
    return { keywords: [DEFAULT_KEYWORD], mode: detectedMode, normalized: DEFAULT_KEYWORD };
  }

  if (/\s+OR\s+|\s*\|\s*|\s*｜\s*/i.test(s)) {
    detectedMode = 'or';
    s = s.replace(/\s+OR\s+|\s*\|\s*|\s*｜\s*/gi, '+');
  } else if (/\s+AND\s+|\s*&\s*/i.test(s)) {
    detectedMode = 'and';
    s = s.replace(/\s+AND\s+|\s*&\s*/gi, '+');
  }

  const parts = s
    .split(/[+＋、,，]+/)
    .map((t) => t.replace(/"/g, '').trim())
    .filter(Boolean);

  const unique = [...new Set(parts)];
  const keywords = unique.length > 0 ? unique.slice(0, 8) : [DEFAULT_KEYWORD];
  return {
    keywords,
    mode: detectedMode,
    normalized: keywords.join('+'),
  };
}

function parseKeywordList(rawKeyword = DEFAULT_KEYWORD) {
  return parseSearchExpression(rawKeyword, 'or').keywords;
}

function normalizeKeywordString(rawKeyword = DEFAULT_KEYWORD) {
  return parseSearchExpression(rawKeyword, 'or').normalized;
}

/**
 * Build Google Search / Google News boolean query string
 * - OR:  "A" OR "B" (or unquoted A OR B when loose=true)
 * - AND: "A" AND "B" (or unquoted A B when loose=true)
 */
function buildGoogleBooleanQuery(keywords, mode = 'or', loose = false) {
  const list = Array.isArray(keywords) ? keywords : parseKeywordList(keywords);
  if (list.length === 1) {
    return loose ? list[0] : `"${list[0]}"`;
  }
  if (mode === 'and') {
    return loose ? list.join(' ') : list.map((k) => `"${k}"`).join(' AND ');
  }
  return loose ? list.join(' OR ') : list.map((k) => `"${k}"`).join(' OR ');
}

/**
 * Build LYAPI v2 (Elasticsearch simple_query_string) boolean query string
 * - OR:  "A" | "B"
 * - AND: +"A" +"B"  (critical: space alone in LYAPI defaults to OR!)
 */
function buildLyApiBooleanQuery(keywords, mode = 'or') {
  const list = Array.isArray(keywords) ? keywords : parseKeywordList(keywords);
  if (list.length === 1) return `"${list[0]}"`;
  if (mode === 'and') {
    return list.map((k) => `+"${k}"`).join(' ');
  }
  return list.map((k) => `"${k}"`).join(' | ');
}

function computeMatchedKeywords(item, keywords, fallbackKw = '') {
  const hay = `${item.title || ''} ${item.summary || ''} ${item.source || ''} ${item.meta || ''}`.toLowerCase();
  const matched = keywords.filter((kw) => hay.includes(kw.toLowerCase()));
  if (matched.length === 0 && fallbackKw) return [fallbackKw];
  return matched.length > 0 ? matched : [...keywords];
}

function extractHighlightSnippet(obj) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of Object.keys(obj)) {
    if (key.endsWith(':highlight') && Array.isArray(obj[key]) && obj[key].length > 0) {
      return stripHtml(obj[key].slice(0, 2).join(' … '));
    }
  }
  return '';
}

function extractTag(xmlBlock, tagName) {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xmlBlock.match(regex);
  return match ? decodeHtmlEntities(match[1].trim()) : '';
}

function extractAttr(xmlBlock, tagName, attrName) {
  const regex = new RegExp(`<${tagName}[^>]*\\s${attrName}=["']([^"']+)["'][^>]*>`, 'i');
  const match = xmlBlock.match(regex);
  return match ? decodeHtmlEntities(match[1].trim()) : '';
}

function parseFlexibleDate(raw) {
  if (!raw) return null;
  const s = String(Array.isArray(raw) ? raw[0] || '' : raw).trim();
  if (!s) return null;

  const roc7 = s.match(/^(\d{3})(\d{2})(\d{2})$/);
  if (roc7) {
    const year = parseInt(roc7[1], 10) + 1911;
    return new Date(`${year}-${roc7[2]}-${roc7[3]}T08:00:00+08:00`);
  }

  const rocSep = s.match(/^(\d{2,3})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);
  if (rocSep && parseInt(rocSep[1], 10) < 300) {
    const year = parseInt(rocSep[1], 10) + 1911;
    const month = rocSep[2].padStart(2, '0');
    const day = rocSep[3].padStart(2, '0');
    return new Date(`${year}-${month}-${day}T08:00:00+08:00`);
  }

  const isoDateOnly = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  if (isoDateOnly) {
    const year = isoDateOnly[1];
    const month = isoDateOnly[2].padStart(2, '0');
    const day = isoDateOnly[3].padStart(2, '0');
    return new Date(`${year}-${month}-${day}T08:00:00+08:00`);
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseRssItems(xmlText, fallbackSource = '新聞來源') {
  if (!xmlText) return [];
  const items = [];
  const itemMatches = xmlText.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];

  for (const block of itemMatches) {
    let rawTitle = extractTag(block, 'title');
    let link = extractTag(block, 'link');
    if (!link) {
      const guid = extractTag(block, 'guid');
      if (guid && /^https?:\/\//i.test(guid)) link = guid;
    }
    try {
      if (link && link.includes('bing.com/news/apiclick.aspx')) {
        const u = new URL(link);
        const realUrl = u.searchParams.get('url');
        if (realUrl) link = realUrl;
      }
    } catch (_) {}

    const pubDateRaw =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'dc:date') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated');
    let source =
      extractTag(block, 'source') ||
      extractTag(block, 'News:Source') ||
      extractTag(block, 'dc:creator') ||
      '';
    const sourceUrl = extractAttr(block, 'source', 'url');

    if (rawTitle) {
      const dashIdx = rawTitle.lastIndexOf(' - ');
      if (dashIdx > 4) {
        const suffix = rawTitle.slice(dashIdx + 3).trim();
        if (suffix && suffix.length <= 30) {
          if (!source) source = suffix;
          rawTitle = rawTitle.slice(0, dashIdx).trim();
        }
      }
    }

    const rawDesc = extractTag(block, 'description');
    let summary = stripHtml(rawDesc);
    if (summary && rawTitle && summary.startsWith(rawTitle)) {
      summary = summary.slice(rawTitle.length).replace(/^[\s\-—·|]+/, '').trim();
    }
    if (source && summary === source) {
      summary = '';
    }

    const dt = parseFlexibleDate(pubDateRaw);
    if (!rawTitle) continue;

    items.push({
      title: rawTitle,
      link: link || sourceUrl || '#',
      source: source || fallbackSource,
      sourceUrl: sourceUrl || '',
      summary: summary ? summary.slice(0, 220) : '',
      publishedAt: dt ? dt.toISOString() : null,
      timestamp: dt ? dt.getTime() : 0,
    });
  }

  return items;
}

async function safeFetchText(url, timeoutMs = 9500) {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return await res.text();
}

async function safeFetchJson(url, timeoutMs = 9500) {
  const text = await safeFetchText(url, timeoutMs);
  return JSON.parse(text);
}

function deduplicateItems(items) {
  const seen = new Map();
  const result = [];
  for (const item of items) {
    const normKey = (item.title || '')
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, '')
      .slice(0, 44);
    if (!normKey) continue;
    if (seen.has(normKey)) {
      const existing = seen.get(normKey);
      if (Array.isArray(item.matchedKeywords)) {
        const mergedKw = new Set([...(existing.matchedKeywords || []), ...item.matchedKeywords]);
        existing.matchedKeywords = [...mergedKw];
      }
      continue;
    }
    const cloned = { ...item };
    seen.set(normKey, cloned);
    result.push(cloned);
  }
  return result;
}

/**
 * Zone 1: Real-time News Fetcher with proper Google/Bing OR & AND boolean syntax
 */
async function fetchRealtimeNews(rawKeyword = DEFAULT_KEYWORD, rawMode = 'or') {
  const { keywords, mode, normalized } = parseSearchExpression(rawKeyword, rawMode);

  const combinedItems = [];
  const sourceSummaryMap = new Map();
  const errors = [];

  const addSourceCount = (name, cnt) => {
    if (cnt > 0) sourceSummaryMap.set(name, (sourceSummaryMap.get(name) || 0) + cnt);
  };

  if (mode === 'and') {
    const gStrictQuery = buildGoogleBooleanQuery(keywords, 'and', false);
    const bingAndQuery = keywords.join(' ');

    const settled = await Promise.allSettled([
      safeFetchText(
        `https://news.google.com/rss/search?q=${encodeURIComponent(gStrictQuery)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
        9500
      ).then((xml) => ({ provider: 'Google 新聞 (台灣)', items: parseRssItems(xml, '台灣新聞') })),
      safeFetchText(
        `https://www.bing.com/news/search?q=${encodeURIComponent(bingAndQuery)}&format=rss&mkt=zh-TW`,
        9500
      ).then((xml) => ({ provider: 'Bing 新聞 (台灣)', items: parseRssItems(xml, '即時新聞') })),
    ]);

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        addSourceCount(s.value.provider, s.value.items.length);
        for (const it of s.value.items) {
          combinedItems.push({
            ...it,
            matchedKeywords: computeMatchedKeywords(it, keywords),
          });
        }
      } else {
        errors.push(s.reason?.message || String(s.reason));
      }
    }

    // Fallback to unquoted AND query if quoted phrase was too strict
    if (combinedItems.length === 0) {
      try {
        const gLooseQuery = buildGoogleBooleanQuery(keywords, 'and', true);
        const xml = await safeFetchText(
          `https://news.google.com/rss/search?q=${encodeURIComponent(gLooseQuery)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
          9500
        );
        const looseItems = parseRssItems(xml, '台灣新聞');
        addSourceCount('Google 新聞 (台灣)', looseItems.length);
        looseItems.forEach((it) =>
          combinedItems.push({ ...it, matchedKeywords: computeMatchedKeywords(it, keywords) })
        );
      } catch (_) {}
    }
  } else {
    // OR mode: run unified Google OR query + per-keyword Google & Bing queries so every keyword gets rich results!
    const tasks = [];
    if (keywords.length > 1) {
      const gOrQuery = buildGoogleBooleanQuery(keywords, 'or', false);
      tasks.push(
        safeFetchText(
          `https://news.google.com/rss/search?q=${encodeURIComponent(gOrQuery)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
          9500
        ).then((xml) => ({ provider: 'Google 新聞 (台灣)', items: parseRssItems(xml, '台灣新聞'), tagKw: '' }))
      );
    }

    for (const kw of keywords) {
      tasks.push(
        safeFetchText(
          `https://news.google.com/rss/search?q=${encodeURIComponent(kw)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
          9500
        ).then((xml) => ({ provider: 'Google 新聞 (台灣)', items: parseRssItems(xml, '台灣新聞'), tagKw: kw }))
      );
      tasks.push(
        safeFetchText(
          `https://www.bing.com/news/search?q=${encodeURIComponent(kw)}&format=rss&mkt=zh-TW`,
          9500
        ).then((xml) => ({ provider: 'Bing 新聞 (台灣)', items: parseRssItems(xml, '即時新聞'), tagKw: kw }))
      );
    }

    const settled = await Promise.allSettled(tasks);
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        addSourceCount(s.value.provider, s.value.items.length);
        for (const it of s.value.items) {
          combinedItems.push({
            ...it,
            matchedKeywords: computeMatchedKeywords(it, keywords, s.value.tagKw),
          });
        }
      } else {
        errors.push(s.reason?.message || String(s.reason));
      }
    }
  }

  let deduped = deduplicateItems(combinedItems).sort((a, b) => b.timestamp - a.timestamp);

  // In AND mode with 2+ keywords, prioritize items where all keywords appear in title/summary;
  // if strict title/summary filter has matches, return those cleanly!
  if (mode === 'and' && keywords.length > 1) {
    const strictHits = deduped.filter((it) => {
      const hay = `${it.title || ''} ${it.summary || ''}`.toLowerCase();
      return keywords.every((k) => hay.includes(k.toLowerCase()));
    });
    if (strictHits.length > 0) {
      deduped = strictHits;
    }
  }

  const activeSources = [...sourceSummaryMap.entries()].map(([name, count]) => ({ name, count }));

  return {
    keyword: normalized,
    keywords,
    mode,
    fetchedAt: new Date().toISOString(),
    total: deduped.length,
    sources: activeSources,
    errors: deduped.length === 0 ? errors : [],
    items: deduped.slice(0, 80),
  };
}

async function fetchLyBillsByQuery(lyQuery) {
  const url = `https://v2.ly.govapi.tw/bills?q=${encodeURIComponent(lyQuery)}&limit=20`;
  const data = await safeFetchJson(url, 9500);
  const rawList = Array.isArray(data?.bills) ? data.bills : [];

  return rawList
    .map((b) => {
      const title = b['議案名稱'] || b['案名'] || b.bill_name || '';
      if (!title) return null;

      const proposerRaw = b['提案單位/提案委員'] || b['提案人'] || b.proposer || '';
      const proposer = Array.isArray(proposerRaw) ? proposerRaw.join('、') : String(proposerRaw || '');
      const status = b['議案狀態'] || b.status || '';
      const billNo = b['字號'] || b['提案編號'] || b['議案編號'] || '';
      const term = b['屆'] || '';
      const sessionPeriod = b['會期'] || '';
      const categoryType = b['議案類別'] || '議案提案';

      const dateStr = b['最新進度日期'] || b['提案日期'] || b['資料抓取時間'] || '';
      const dt = parseFlexibleDate(dateStr);

      const idForLink = b['議案編號'] || '';
      const link =
        b.url ||
        (idForLink
          ? `https://ppg.ly.gov.tw/ppg/bills/${encodeURIComponent(idForLink)}/details`
          : 'https://ppg.ly.gov.tw/ppg/');

      const highlightSnippet = extractHighlightSnippet(b);
      const summaryParts = [];
      if (proposer) summaryParts.push(`提案：${proposer}`);
      if (status) summaryParts.push(`進度：${status}`);
      if (highlightSnippet) summaryParts.push(`摘要：${highlightSnippet}`);
      else if (billNo) summaryParts.push(`字號：${billNo}`);

      return {
        category: 'bill',
        categoryLabel: '議案／法案',
        title: stripHtml(title),
        link,
        source: `立法院・${categoryType}`,
        meta: [
          term ? `第${term}屆` : '',
          sessionPeriod ? `第${sessionPeriod}會期` : '',
          status || '',
        ]
          .filter(Boolean)
          .join(' · '),
        proposer: proposer.slice(0, 45),
        summary: summaryParts.join(' ｜ ').slice(0, 260),
        publishedAt: dt ? dt.toISOString() : null,
        timestamp: dt ? dt.getTime() : 0,
      };
    })
    .filter(Boolean);
}

async function fetchLySpeechesAndGazettesByQuery(lyQuery) {
  const enc = encodeURIComponent(lyQuery);

  const ivodUrl = `https://v2.ly.govapi.tw/ivods?q=${enc}&%E5%BD%B1%E7%89%87%E7%A8%AE%E9%A1%9E=Clip&limit=15`;
  const gazetteUrl = `https://v2.ly.govapi.tw/gazette_agendas?q=${enc}&limit=12`;
  const interpUrl = `https://v2.ly.govapi.tw/interpellations?q=${enc}&limit=10`;

  const settled = await Promise.allSettled([
    safeFetchJson(ivodUrl, 9500),
    safeFetchJson(gazetteUrl, 9500),
    safeFetchJson(interpUrl, 9500),
  ]);

  const items = [];

  if (settled[0].status === 'fulfilled') {
    const ivods = Array.isArray(settled[0].value?.ivods) ? settled[0].value.ivods : [];
    for (const v of ivods) {
      const member = v['委員名稱'] || '';
      const meetTitle = v['會議資料']?.['標題'] || v['會議名稱']?.split('（')[0] || '立法院會議';
      const dateStr = v['會議時間'] || v['開始時間'] || v['日期'] || '';
      const dt = parseFlexibleDate(dateStr);
      const snippet = extractHighlightSnippet(v);
      const committee = Array.isArray(v['會議資料']?.['委員會代碼:str'])
        ? v['會議資料']['委員會代碼:str'].join('、')
        : '院會／委員會';

      items.push({
        category: 'interpellation',
        categoryLabel: '質詢發言／公報',
        title:
          member && member !== '完整會議'
            ? `【${member}委員發言質詢】${meetTitle}`
            : `${meetTitle}（議事轉播紀錄）`,
        link: v.IVOD_URL || 'https://ivod.ly.gov.tw/',
        source: `立法院議事轉播 IVOD・${committee}`,
        meta: [
          member ? `發言委員：${member}` : '',
          v['委員發言時間'] ? `時段：${v['委員發言時間']}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        proposer: member,
        summary: snippet
          ? `發言提及：「…${snippet}…」 ｜ ${stripHtml(v['會議名稱'] || '').slice(0, 140)}`
          : stripHtml(v['會議名稱'] || '').slice(0, 220),
        publishedAt: dt ? dt.toISOString() : null,
        timestamp: dt ? dt.getTime() : 0,
      });
    }
  }

  if (settled[1].status === 'fulfilled') {
    const agendas = Array.isArray(settled[1].value?.gazetteagendas)
      ? settled[1].value.gazetteagendas
      : Array.isArray(settled[1].value?.agendas)
      ? settled[1].value.agendas
      : [];
    for (const g of agendas) {
      const subject = stripHtml(g['案由'] || '');
      if (!subject) continue;
      const dt = parseFlexibleDate(g['會議日期']);
      const vol = g['卷'] ? `第${g['卷']}卷` : '';
      const issue = g['期'] ? `第${g['期']}期` : '';
      const snippet = extractHighlightSnippet(g) || subject;

      items.push({
        category: 'interpellation',
        categoryLabel: '質詢發言／公報',
        title: subject.length > 74 ? `${subject.slice(0, 74)}…` : subject,
        link: g['公報網網址'] || g['公報完整PDF網址'] || 'https://ppg.ly.gov.tw/ppg/',
        source: `立法院公報 ${vol}${issue}`,
        meta: [
          g['屆'] ? `第${g['屆']}屆` : '',
          g['會期'] ? `第${g['會期']}會期` : '',
          `公報編號 ${g['公報編號'] || ''}`,
        ]
          .filter(Boolean)
          .join(' · '),
        proposer: '',
        summary: snippet.slice(0, 240),
        publishedAt: dt ? dt.toISOString() : null,
        timestamp: dt ? dt.getTime() : 0,
      });
    }
  }

  if (settled[2].status === 'fulfilled') {
    const interps = Array.isArray(settled[2].value?.interpellations)
      ? settled[2].value.interpellations
      : [];
    for (const it of interps) {
      const subject = stripHtml(it['事由'] || '');
      if (!subject) continue;
      const members = Array.isArray(it['質詢委員'])
        ? it['質詢委員'].join('、')
        : String(it['質詢委員'] || '');
      const dt = parseFlexibleDate(it['刊登日期']);
      const snippet = extractHighlightSnippet(it) || subject;

      items.push({
        category: 'interpellation',
        categoryLabel: '質詢發言／公報',
        title: members
          ? `【${members}委員書面質詢】${subject.slice(0, 62)}${subject.length > 62 ? '…' : ''}`
          : subject.slice(0, 72),
        link: it['來源頁面'] || it['來源PDF'] || 'https://ppg.ly.gov.tw/ppg/',
        source: '立法院關係文書・專案質詢',
        meta: [
          it['屆'] ? `第${it['屆']}屆` : '',
          it['會期'] ? `第${it['會期']}會期` : '',
          members ? `質詢委員：${members}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        proposer: members,
        summary: snippet.slice(0, 240),
        publishedAt: dt ? dt.toISOString() : null,
        timestamp: dt ? dt.getTime() : 0,
      });
    }
  }

  return items;
}

async function fetchLyOfficialSiteByGoogleExpr(googleExpr, keywords, mode) {
  const siteQuery = encodeURIComponent(`site:ly.gov.tw (${googleExpr})`);
  const googleLySiteUrl = `https://news.google.com/rss/search?q=${siteQuery}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;

  const now = new Date();
  const rocYear = now.getFullYear() - 1911;
  const fromRoc = `${rocYear - 2}0101`;
  const toRoc = `${rocYear + 1}1231`;

  const budgetTypes = ['預算案評估', '專題研究'];
  const lawTypes = ['議題研析', '法案評估', '專題研究'];

  const matchRecord = (r) => {
    const str = JSON.stringify(r).toLowerCase();
    return mode === 'and'
      ? keywords.every((k) => str.includes(k.toLowerCase()))
      : keywords.some((k) => str.includes(k.toLowerCase()));
  };

  const kwDisplay = keywords.join('、');

  const tasks = [
    safeFetchText(googleLySiteUrl, 8500).then((xml) =>
      parseRssItems(xml, '立法院全球資訊網').map((it) => ({
        category: 'official',
        categoryLabel: '官網／研究報告',
        title: it.title,
        link: it.link,
        source: '立法院全球資訊網 (ly.gov.tw)',
        meta: '立法院官方網站發布',
        proposer: '',
        summary: it.summary,
        publishedAt: it.publishedAt,
        timestamp: it.timestamp,
      }))
    ),
    ...budgetTypes.map((t) =>
      safeFetchJson(
        `https://www.ly.gov.tw/WebAPI/BudgetCenterResearch.aspx?type=${encodeURIComponent(t)}&from=${fromRoc}&to=${toRoc}&mode=json`,
        8500
      ).then((arr) => {
        const list = Array.isArray(arr) ? arr : Array.isArray(arr?.data) ? arr.data : [];
        return list
          .filter(matchRecord)
          .map((r) => {
            const title = r.title || r.Title || r['報告名稱'] || r['題目'] || '';
            const dateRaw = r.date || r.Date || r['出版日期'] || r['發表日期'] || '';
            const dt = parseFlexibleDate(dateRaw);
            const url = r.url || r.Url || r['網址'] || 'https://www.ly.gov.tw/Pages/List.aspx?nodeid=147';
            return {
              category: 'official',
              categoryLabel: '官網／研究報告',
              title: stripHtml(title),
              link: url,
              source: `立法院預算中心・${t}`,
              meta: '預算中心研究成果',
              proposer: r.author || r['撰稿人'] || '',
              summary: stripHtml(
                r.summary || r.Summary || r['摘要'] || `立法院預算中心針對「${kwDisplay}」相關計畫與預算之${t}報告。`
              ).slice(0, 220),
              publishedAt: dt ? dt.toISOString() : null,
              timestamp: dt ? dt.getTime() : 0,
            };
          })
          .filter((x) => x.title);
      })
    ),
    ...lawTypes.map((t) =>
      safeFetchJson(
        `https://www.ly.gov.tw/WebAPI/LawMakerResearch.aspx?type=${encodeURIComponent(t)}&from=${fromRoc}&to=${toRoc}&mode=json`,
        8500
      ).then((arr) => {
        const list = Array.isArray(arr) ? arr : Array.isArray(arr?.data) ? arr.data : [];
        return list
          .filter(matchRecord)
          .map((r) => {
            const title = r.title || r.Title || r['報告名稱'] || r['題目'] || '';
            const dateRaw = r.date || r.Date || r['出版日期'] || r['發表日期'] || '';
            const dt = parseFlexibleDate(dateRaw);
            const url = r.url || r.Url || r['網址'] || 'https://www.ly.gov.tw/Pages/List.aspx?nodeid=146';
            return {
              category: 'official',
              categoryLabel: '官網／研究報告',
              title: stripHtml(title),
              link: url,
              source: `立法院法制局・${t}`,
              meta: '法制局研究成果',
              proposer: r.author || r['撰稿人'] || '',
              summary: stripHtml(
                r.summary || r.Summary || r['摘要'] || `立法院法制局針對「${kwDisplay}」相關法制與政策議題之${t}報告。`
              ).slice(0, 220),
              publishedAt: dt ? dt.toISOString() : null,
              timestamp: dt ? dt.getTime() : 0,
            };
          })
          .filter((x) => x.title);
      })
    ),
  ];

  const settled = await Promise.allSettled(tasks);
  const collected = [];
  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      collected.push(...s.value);
    }
  }
  return collected;
}

async function fetchLyPressNewsByGoogleExpr(googleExpr) {
  const q = encodeURIComponent(`"立法院" (${googleExpr})`);
  const googleUrl = `https://news.google.com/rss/search?q=${q}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;

  const items = [];
  try {
    const xml = await safeFetchText(googleUrl, 8500);
    for (const it of parseRssItems(xml, '國會新聞')) {
      const isOfficialDomain =
        (it.link || '').includes('ly.gov.tw') || (it.sourceUrl || '').includes('ly.gov.tw');
      items.push({
        category: isOfficialDomain ? 'official' : 'press',
        categoryLabel: isOfficialDomain ? '官網／研究報告' : '國會新聞動態',
        title: it.title,
        link: it.link,
        source: isOfficialDomain ? '立法院全球資訊網' : `國會動態・${it.source}`,
        meta: isOfficialDomain ? '立法院官方發布' : '立法院新聞稿與相關報導',
        proposer: '',
        summary: it.summary,
        publishedAt: it.publishedAt,
        timestamp: it.timestamp,
      });
    }
  } catch (_) {}
  return items;
}

/**
 * Zone 2: Legislative Yuan Published Messages Aggregator with true OR & AND boolean syntax
 */
async function fetchLegislativeYuanUpdates(rawKeyword = DEFAULT_KEYWORD, rawMode = 'or') {
  const { keywords, mode, normalized } = parseSearchExpression(rawKeyword, rawMode);
  const lyQuery = buildLyApiBooleanQuery(keywords, mode);
  const googleExpr = buildGoogleBooleanQuery(keywords, mode, false);

  const settled = await Promise.allSettled([
    fetchLyBillsByQuery(lyQuery),
    fetchLySpeechesAndGazettesByQuery(lyQuery),
    fetchLyOfficialSiteByGoogleExpr(googleExpr, keywords, mode),
    fetchLyPressNewsByGoogleExpr(googleExpr),
  ]);

  const labels = [
    '立法院議案／法案',
    '立法院質詢發言與公報',
    '立法院官網與研究報告',
    '立法院新聞稿與國會動態',
  ];
  const allItems = [];
  const activeSources = [];
  const errors = [];

  settled.forEach((s, idx) => {
    if (s.status === 'fulfilled') {
      activeSources.push({ name: labels[idx], count: s.value.length });
      for (const it of s.value) {
        allItems.push({
          ...it,
          matchedKeywords: computeMatchedKeywords(it, keywords),
        });
      }
    } else {
      errors.push(`${labels[idx]}: ${s.reason?.message || String(s.reason)}`);
    }
  });

  const deduped = deduplicateItems(allItems).sort((a, b) => b.timestamp - a.timestamp);

  const counts = {
    all: deduped.length,
    official: deduped.filter((i) => i.category === 'official').length,
    bill: deduped.filter((i) => i.category === 'bill').length,
    interpellation: deduped.filter((i) => i.category === 'interpellation').length,
    press: deduped.filter((i) => i.category === 'press').length,
  };

  return {
    keyword: normalized,
    keywords,
    mode,
    fetchedAt: new Date().toISOString(),
    total: deduped.length,
    counts,
    sources: activeSources,
    errors: deduped.length === 0 ? errors : [],
    items: deduped.slice(0, 100),
  };
}

module.exports = {
  DEFAULT_KEYWORD,
  parseSearchExpression,
  parseKeywordList,
  normalizeKeywordString,
  buildGoogleBooleanQuery,
  buildLyApiBooleanQuery,
  fetchRealtimeNews,
  fetchLegislativeYuanUpdates,
};
