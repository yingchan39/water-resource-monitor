(() => {
  const AUTO_REFRESH_SECONDS = 300; // 5 minutes
  const STORAGE_KEY_GOV_KW = 'magicConch_govCustomKeywords_v2';

  let savedCustomGovKw = {};
  try {
    const rawSaved = localStorage.getItem(STORAGE_KEY_GOV_KW);
    if (rawSaved) savedCustomGovKw = JSON.parse(rawSaved) || {};
  } catch (_) {}

  const state = {
    keyword: '水資源',
    keywords: ['水資源'],
    mode: 'or',
    viewZone: 'all',

    newsItems: [],
    lyItems: [],
    lyCounts: { all: 0, bill: 0, interpellation: 0, official: 0, press: 0 },
    selectedLyCat: 'all',
    newsFilter: '',
    lyFilter: '',

    // Zone 3: Government Agencies
    govItems: [],
    govAgencies: [],
    selectedGovGroup: 'all',
    selectedGovAgency: 'all',
    editingAgencyId: '3-1',
    customGovKeywords: savedCustomGovKw,
    govKwMode: 'preset',
    govFilter: '',

    countdown: AUTO_REFRESH_SECONDS,
    loading: false,
    hasBackendApi: null,
    manifest: null,
  };

  // Global & Header Elements
  const dashboardGrid = document.getElementById('dashboardGrid');
  const zone1Panel = document.getElementById('zone1Panel');
  const zone2Panel = document.getElementById('zone2Panel');
  const zone3Panel = document.getElementById('zone3Panel');
  const zoneViewSwitcher = document.getElementById('zoneViewSwitcher');

  const keywordForm = document.getElementById('keywordForm');
  const keywordInput = document.getElementById('keywordInput');
  const matchModeSelect = document.getElementById('matchModeSelect');
  const refreshBtn = document.getElementById('refreshBtn');
  const autoRefreshToggle = document.getElementById('autoRefreshToggle');
  const countdownText = document.getElementById('countdownText');
  const activeKeywordBadge = document.getElementById('activeKeywordBadge');
  const lastSyncText = document.getElementById('lastSyncText');
  const quickChips = document.querySelectorAll('.tag-chip');
  const kwInlines = document.querySelectorAll('.kw-inline');

  // Zone 1 Elements
  const newsCountPill = document.getElementById('newsCountPill');
  const newsSourcesSummary = document.getElementById('newsSourcesSummary');
  const newsFilterInput = document.getElementById('newsFilterInput');
  const newsList = document.getElementById('newsList');

  // Zone 2 Elements
  const lyCountPill = document.getElementById('lyCountPill');
  const lySourcesSummary = document.getElementById('lySourcesSummary');
  const lyFilterInput = document.getElementById('lyFilterInput');
  const lyCategoryTabs = document.getElementById('lyCategoryTabs');
  const lyList = document.getElementById('lyList');

  const catCountEls = {
    all: document.getElementById('catCountAll'),
    bill: document.getElementById('catCountBill'),
    interpellation: document.getElementById('catCountInterp'),
    official: document.getElementById('catCountOfficial'),
    press: document.getElementById('catCountPress'),
  };

  // Zone 3 Elements
  const govCountPill = document.getElementById('govCountPill');
  const govGroupTabs = document.getElementById('govGroupTabs');
  const govAgencyStrip = document.getElementById('govAgencyStrip');
  const editAgencySelect = document.getElementById('editAgencySelect');
  const govMemoHint = document.getElementById('govMemoHint');
  const govKwEditorForm = document.getElementById('govKwEditorForm');
  const agencyKwInput = document.getElementById('agencyKwInput');
  const resetAgencyKwBtn = document.getElementById('resetAgencyKwBtn');
  const resetAllGovKwBtn = document.getElementById('resetAllGovKwBtn');
  const govSaveToast = document.getElementById('govSaveToast');
  const govChannelLinks = document.getElementById('govChannelLinks');
  const govDirectoryGrid = document.getElementById('govDirectoryGrid');
  const govFilterInput = document.getElementById('govFilterInput');
  const govSourcesSummary = document.getElementById('govSourcesSummary');
  const govList = document.getElementById('govList');
  const govKwRadios = document.querySelectorAll('input[name="govKwMode"]');

  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripHtmlText(str = '') {
    const tmp = document.createElement('div');
    tmp.innerHTML = String(str);
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Smart Boolean Search Parser:
   * Supports '+' / '＋' / '、' / ',' AND inline 'OR' / '|' / 'AND' / '&'
   */
  function parseSearchExpression(raw = '水資源', fallbackMode = 'or') {
    let detectedMode = fallbackMode === 'and' ? 'and' : 'or';
    let s = String(raw || '').trim();
    if (!s) {
      return { keywords: ['水資源'], mode: detectedMode, normalized: '水資源' };
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
    const keywords = unique.length > 0 ? unique.slice(0, 8) : ['水資源'];
    return {
      keywords,
      mode: detectedMode,
      normalized: keywords.join('+'),
    };
  }

  /**
   * Build LYAPI v2 Elasticsearch simple_query_string boolean query:
   * - OR:  "A" | "B"
   * - AND: +"A" +"B" (required because space alone in LYAPI defaults to OR!)
   */
  function buildLyApiBooleanQuery(keywords, mode = 'or') {
    if (keywords.length === 1) return `"${keywords[0]}"`;
    if (mode === 'and') {
      return keywords.map((k) => `+"${k}"`).join(' ');
    }
    return keywords.map((k) => `"${k}"`).join(' | ');
  }

  function parseGovFocusInput(raw = '') {
    const parts = String(raw || '')
      .split(/[、,，+＋;；/\s]+/)
      .map((s) => s.replace(/"/g, '').trim())
      .filter(Boolean);
    return [...new Set(parts)];
  }

  function getActiveAgencyKeywords(agencyId) {
    if (Object.prototype.hasOwnProperty.call(state.customGovKeywords, agencyId)) {
      return state.customGovKeywords[agencyId];
    }
    const ag = state.govAgencies.find((a) => a.id === agencyId);
    return ag ? ag.defaultKeywords || [] : [];
  }

  function isAgencyCustomized(agencyId) {
    return Object.prototype.hasOwnProperty.call(state.customGovKeywords, agencyId);
  }

  function persistCustomGovKeywords() {
    try {
      localStorage.setItem(STORAGE_KEY_GOV_KW, JSON.stringify(state.customGovKeywords));
    } catch (_) {}
  }

  let toastTimer = null;
  function flashGovToast(msg) {
    govSaveToast.textContent = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      govSaveToast.textContent = '';
    }, 2800);
  }

  function computeMatchedKeywords(item, keywords, fallbackKw = '') {
    const hay = `${item.title || ''} ${item.summary || ''} ${item.source || ''} ${item.meta || ''}`.toLowerCase();
    const matched = keywords.filter((kw) => hay.includes(kw.toLowerCase()));
    if (matched.length > 0) return matched;
    if (Array.isArray(item.matchedKeywords) && item.matchedKeywords.length > 0) {
      return item.matchedKeywords;
    }
    return fallbackKw ? [fallbackKw] : [...keywords];
  }

  function deduplicateItems(items) {
    const seen = new Map();
    const out = [];
    for (const item of items) {
      const key = String(item.title || '')
        .toLowerCase()
        .replace(/[\s\p{P}\p{S}]+/gu, '')
        .slice(0, 44);
      if (!key) continue;
      if (seen.has(key)) {
        const existing = seen.get(key);
        if (Array.isArray(item.matchedKeywords)) {
          existing.matchedKeywords = [...new Set([...(existing.matchedKeywords || []), ...item.matchedKeywords])];
        }
        continue;
      }
      const cloned = { ...item };
      seen.set(key, cloned);
      out.push(cloned);
    }
    return out;
  }

  function highlightKeyword(text = '', keywords = state.keywords) {
    const escaped = escapeHtml(text);
    const list = Array.isArray(keywords) ? keywords : [keywords];
    const tokens = list
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map((t) => escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (tokens.length === 0) return escaped;
    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    return escaped.replace(regex, '<mark class="kw-mark">$1</mark>');
  }

  function updateKeywordBadgesUI() {
    const kws = state.keywords;
    const modeLabel = kws.length > 1 ? (state.mode === 'and' ? '（AND 皆須包含）' : '（OR 任一符合）') : '';
    const sepSymbol = state.mode === 'and' ? 'AND' : 'OR';

    activeKeywordBadge.innerHTML = kws
      .map((k) => `<strong class="active-keyword-pill">【${escapeHtml(k)}】</strong>`)
      .join(`<span class="kw-plus-sep">${sepSymbol}</span>`);

    const inlineText = kws.map((k) => `【${k}】`).join('＋') + modeLabel;
    kwInlines.forEach((el) => {
      el.textContent = inlineText;
    });
  }

  function renderMatchedKeywordChips(item) {
    const hits = computeMatchedKeywords(item, state.keywords);
    if (state.keywords.length <= 1) {
      return `<span class="meta-sub">關鍵字：${escapeHtml(state.keywords[0])}</span>`;
    }
    const chips = hits
      .map((k) => `<span class="kw-hit-chip">#${escapeHtml(k)}</span>`)
      .join('');
    return `<span class="kw-hit-badges"><span class="meta-sub">命中：</span>${chips}</span>`;
  }

  function formatDateDisplay(isoStr) {
    if (!isoStr) return '近期發布';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '近期發布';

    const now = Date.now();
    const diffSec = Math.floor((now - d.getTime()) / 1000);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const exactDate = `${yyyy}/${mm}/${dd}`;
    const exactDateTime = `${yyyy}/${mm}/${dd} ${hh}:${min}`;

    if (diffSec >= 0 && diffSec < 60) return `剛剛 · ${exactDateTime}`;
    if (diffSec >= 60 && diffSec < 3600) return `${Math.floor(diffSec / 60)} 分鐘前 · ${exactDateTime}`;
    if (diffSec >= 3600 && diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小時前 · ${exactDateTime}`;
    if (diffSec >= 86400 && diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} 天前 · ${exactDate}`;
    return exactDate;
  }

  function showSkeletons(container, count = 4) {
    container.innerHTML = Array.from({ length: count })
      .map(() => '<div class="skeleton-card"></div>')
      .join('');
  }

  async function detectBackendMode() {
    if (state.hasBackendApi !== null) return state.hasBackendApi;
    try {
      const res = await fetch('./api/health', { cache: 'no-store' });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          state.hasBackendApi = true;
          return true;
        }
      }
    } catch (_) {}
    state.hasBackendApi = false;
    return false;
  }

  async function loadManifest() {
    if (state.manifest) return state.manifest;
    try {
      const res = await fetch(`./data/manifest.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        state.manifest = await res.json();
      }
    } catch (_) {}
    return state.manifest;
  }

  /**
   * Browser-native CORS Live Taiwan News Fetcher (via verified rss2json + Bing News Taiwan RSS)
   * Works directly on https://yingchan39.github.io with HTTP 200 & Access-Control-Allow-Origin!
   */
  async function fetchLiveNewsViaRss2Json(queryStr, allKeywords, tagKw = '') {
    const bingRssUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(queryStr)}&format=rss&mkt=zh-TW`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(bingRssUrl)}`;

    try {
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8500) });
      if (!res.ok) return [];
      const data = await res.json();
      if (data.status !== 'ok' || !Array.isArray(data.items)) return [];

      return data.items
        .map((it) => {
          let rawTitle = (it.title || '').trim();
          let link = (it.link || '').trim();
          try {
            if (link.includes('bing.com/news/apiclick.aspx')) {
              const u = new URL(link);
              const realUrl = u.searchParams.get('url');
              if (realUrl) link = realUrl;
            }
          } catch (_) {}

          let source = (it.author || '').trim();
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
          if (!rawTitle) return null;

          // rss2json returns pubDate in UTC "YYYY-MM-DD HH:MM:SS"
          const pubRaw = it.pubDate ? `${it.pubDate.replace(' ', 'T')}Z` : '';
          const dt = pubRaw ? new Date(pubRaw) : null;
          const validDt = dt && !Number.isNaN(dt.getTime()) ? dt : null;
          const summary = stripHtmlText(it.description || '').slice(0, 220);

          const obj = {
            title: rawTitle,
            link: link || '#',
            source: source || '即時新聞',
            summary,
            publishedAt: validDt ? validDt.toISOString() : null,
            timestamp: validDt ? validDt.getTime() : 0,
          };
          obj.matchedKeywords = computeMatchedKeywords(obj, allKeywords, tagKw);
          return obj;
        })
        .filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  /**
   * Static Mode Zone 1: Combines GitHub Actions Google News snapshots + Live Browser rss2json Bing News!
   */
  async function fetchStaticNews(keywords, mode, forceRefresh) {
    const normalized = keywords.join('+');
    const manifest = await loadManifest();

    // Fast path for exact preset in OR mode when not forcing refresh
    if (!forceRefresh && (mode === 'or' || keywords.length === 1)) {
      const exactPreset = manifest?.presets?.[normalized];
      if (exactPreset?.newsFile && exactPreset.newsCount > 0) {
        try {
          const res = await fetch(`${exactPreset.newsFile}?t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) return await res.json();
        } catch (_) {}
      }
    }

    // 1) Load all pre-built snapshots from manifest to form a rich local Google News pool
    const snapshotPool = [];
    if (manifest?.presets) {
      const presetEntries = Object.values(manifest.presets);
      const chunks = await Promise.all(
        presetEntries.map(async (entry) => {
          if (!entry?.newsFile) return [];
          try {
            const r = await fetch(`${entry.newsFile}?t=${Date.now()}`);
            if (r.ok) {
              const j = await r.json();
              return j.items || [];
            }
          } catch (_) {}
          return [];
        })
      );
      chunks.forEach((arr) => snapshotPool.push(...arr));
    }

    const matchedFromSnapshots = snapshotPool
      .filter((it) => {
        const hay = `${it.title || ''} ${it.summary || ''} ${it.source || ''}`.toLowerCase();
        return mode === 'and'
          ? keywords.every((k) => hay.includes(k.toLowerCase()))
          : keywords.some((k) => hay.includes(k.toLowerCase()));
      })
      .map((it) => ({
        ...it,
        matchedKeywords: computeMatchedKeywords(it, keywords),
      }));

    // 2) Live Browser Real-Time Search via rss2json + Bing News Taiwan RSS (supports ANY keyword!)
    const liveItems = [];
    if (mode === 'and') {
      const andItems = await fetchLiveNewsViaRss2Json(keywords.join(' '), keywords, '');
      liveItems.push(...andItems);
    } else {
      // OR mode: query each keyword in parallel so every keyword gets live results!
      const perKwArrays = await Promise.all(
        keywords.map((kw) => fetchLiveNewsViaRss2Json(kw, keywords, kw))
      );
      perKwArrays.forEach((arr) => liveItems.push(...arr));
    }

    let merged = deduplicateItems([...liveItems, ...matchedFromSnapshots]).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );

    if (mode === 'and' && keywords.length > 1) {
      const strictAnd = merged.filter((it) => {
        const hay = `${it.title || ''} ${it.summary || ''}`.toLowerCase();
        return keywords.every((k) => hay.includes(k.toLowerCase()));
      });
      if (strictAnd.length > 0) merged = strictAnd;
    }

    const activeSources = [];
    if (liveItems.length > 0) activeSources.push({ name: '即時新聞檢索 (台灣)', count: liveItems.length });
    if (matchedFromSnapshots.length > 0)
      activeSources.push({ name: 'Google 新聞同步庫', count: matchedFromSnapshots.length });

    return {
      keyword: normalized,
      keywords,
      mode,
      fetchedAt: new Date().toISOString(),
      total: merged.length,
      sources: activeSources,
      items: merged.slice(0, 80),
    };
  }

  function extractHighlightClient(obj) {
    if (!obj || typeof obj !== 'object') return '';
    for (const k of Object.keys(obj)) {
      if (k.endsWith(':highlight') && Array.isArray(obj[k]) && obj[k].length > 0) {
        return stripHtmlText(obj[k].slice(0, 2).join(' … '));
      }
    }
    return '';
  }

  async function fetchLiveLyByBooleanQuery(lyQueryStr, allKeywords, fallbackKw = '') {
    const enc = encodeURIComponent(lyQueryStr);
    const settled = await Promise.allSettled([
      fetch(`https://v2.ly.govapi.tw/bills?q=${enc}&limit=20`).then((r) => r.json()),
      fetch(`https://v2.ly.govapi.tw/ivods?q=${enc}&%E5%BD%B1%E7%89%87%E7%A8%AE%E9%A1%9E=Clip&limit=15`).then((r) => r.json()),
      fetch(`https://v2.ly.govapi.tw/gazette_agendas?q=${enc}&limit=12`).then((r) => r.json()),
    ]);

    const items = [];

    if (settled[0].status === 'fulfilled') {
      for (const b of settled[0].value?.bills || []) {
        const title = stripHtmlText(b['議案名稱'] || '');
        if (!title) continue;
        const proposerRaw = b['提案單位/提案委員'] || b['提案人'] || '';
        const proposer = Array.isArray(proposerRaw) ? proposerRaw.join('、') : String(proposerRaw);
        const status = b['議案狀態'] || '';
        const dateStr = b['最新進度日期'] || b['資料抓取時間'] || '';
        const dt = dateStr ? new Date(dateStr) : null;
        const snippet = extractHighlightClient(b);
        const summary = [
          proposer ? `提案：${proposer}` : '',
          status ? `進度：${status}` : '',
          snippet ? `摘要：${snippet}` : '',
        ]
          .filter(Boolean)
          .join(' ｜ ')
          .slice(0, 260);

        const obj = {
          category: 'bill',
          categoryLabel: '議案／法案',
          title,
          link: b.url || `https://ppg.ly.gov.tw/ppg/bills/${encodeURIComponent(b['議案編號'] || '')}/details`,
          source: `立法院・${b['議案類別'] || '議案提案'}`,
          meta: [b['屆'] ? `第${b['屆']}屆` : '', b['會期'] ? `第${b['會期']}會期` : '', status]
            .filter(Boolean)
            .join(' · '),
          proposer,
          summary,
          publishedAt: dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null,
          timestamp: dt && !Number.isNaN(dt.getTime()) ? dt.getTime() : 0,
        };
        obj.matchedKeywords = computeMatchedKeywords(obj, allKeywords, fallbackKw);
        items.push(obj);
      }
    }

    if (settled[1].status === 'fulfilled') {
      for (const v of settled[1].value?.ivods || []) {
        const member = v['委員名稱'] || '';
        const meetTitle = v['會議資料']?.['標題'] || '立法院會議';
        const dateStr = v['會議時間'] || v['開始時間'] || v['日期'] || '';
        const dt = dateStr ? new Date(dateStr) : null;
        const snippet = extractHighlightClient(v);
        const committee = Array.isArray(v['會議資料']?.['委員會代碼:str'])
          ? v['會議資料']['委員會代碼:str'].join('、')
          : '委員會';

        const obj = {
          category: 'interpellation',
          categoryLabel: '質詢發言／公報',
          title: member && member !== '完整會議' ? `【${member}委員發言質詢】${meetTitle}` : meetTitle,
          link: v.IVOD_URL || 'https://ivod.ly.gov.tw/',
          source: `立法院議事轉播 IVOD・${committee}`,
          meta: member ? `發言委員：${member}` : '',
          proposer: member,
          summary: snippet ? `發言提及：「…${snippet}…」` : stripHtmlText(v['會議名稱'] || '').slice(0, 200),
          publishedAt: dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null,
          timestamp: dt && !Number.isNaN(dt.getTime()) ? dt.getTime() : 0,
        };
        obj.matchedKeywords = computeMatchedKeywords(obj, allKeywords, fallbackKw);
        items.push(obj);
      }
    }

    if (settled[2].status === 'fulfilled') {
      const agendas = settled[2].value?.gazetteagendas || settled[2].value?.agendas || [];
      for (const g of agendas) {
        const subject = stripHtmlText(g['案由'] || '');
        if (!subject) continue;
        const dRaw = Array.isArray(g['會議日期']) ? g['會議日期'][0] : g['會議日期'];
        const dt = dRaw ? new Date(dRaw) : null;
        const obj = {
          category: 'interpellation',
          categoryLabel: '質詢發言／公報',
          title: subject.length > 74 ? `${subject.slice(0, 74)}…` : subject,
          link: g['公報網網址'] || 'https://ppg.ly.gov.tw/ppg/',
          source: `立法院公報 第${g['卷'] || ''}卷第${g['期'] || ''}期`,
          meta: g['屆'] ? `第${g['屆']}屆 · 第${g['會期'] || ''}會期` : '',
          proposer: '',
          summary: (extractHighlightClient(g) || subject).slice(0, 240),
          publishedAt: dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null,
          timestamp: dt && !Number.isNaN(dt.getTime()) ? dt.getTime() : 0,
        };
        obj.matchedKeywords = computeMatchedKeywords(obj, allKeywords, fallbackKw);
        items.push(obj);
      }
    }

    return items;
  }

  async function fetchStaticLy(keywords, mode, forceRefresh) {
    const normalized = keywords.join('+');
    const manifest = await loadManifest();

    if (!forceRefresh && (mode === 'or' || keywords.length === 1)) {
      const exactPreset = manifest?.presets?.[normalized];
      if (exactPreset?.lyFile && exactPreset.lyCount > 0) {
        try {
          const res = await fetch(`${exactPreset.lyFile}?t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) return await res.json();
        } catch (_) {}
      }
    }

    const snapshotPool = [];
    if (manifest?.presets) {
      const presetEntries = Object.values(manifest.presets);
      const chunks = await Promise.all(
        presetEntries.map(async (entry) => {
          if (!entry?.lyFile) return [];
          try {
            const r = await fetch(`${entry.lyFile}?t=${Date.now()}`);
            if (r.ok) {
              const j = await r.json();
              return j.items || [];
            }
          } catch (_) {}
          return [];
        })
      );
      chunks.forEach((c) => snapshotPool.push(...c));
    }

    const filteredSnapshots = snapshotPool
      .filter((it) => {
        const hay = `${it.title || ''} ${it.summary || ''} ${it.source || ''}`.toLowerCase();
        return mode === 'and'
          ? keywords.every((k) => hay.includes(k.toLowerCase()))
          : keywords.some((k) => hay.includes(k.toLowerCase()));
      })
      .map((it) => ({
        ...it,
        matchedKeywords: computeMatchedKeywords(it, keywords),
      }));

    // Live LYAPI v2 with verified +"A" +"B" (AND) vs "A" | "B" (OR) syntax!
    let liveLyItems = [];
    if (keywords.length === 1 || mode === 'and') {
      liveLyItems = await fetchLiveLyByBooleanQuery(
        buildLyApiBooleanQuery(keywords, mode),
        keywords,
        keywords.length === 1 ? keywords[0] : ''
      );
    } else {
      const perKw = await Promise.all(
        keywords.map((kw) => fetchLiveLyByBooleanQuery(`"${kw}"`, keywords, kw))
      );
      perKw.forEach((arr) => liveLyItems.push(...arr));
    }

    const merged = deduplicateItems([...liveLyItems, ...filteredSnapshots]).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );

    const counts = {
      all: merged.length,
      official: merged.filter((i) => i.category === 'official').length,
      bill: merged.filter((i) => i.category === 'bill').length,
      interpellation: merged.filter((i) => i.category === 'interpellation').length,
      press: merged.filter((i) => i.category === 'press').length,
    };

    return {
      keyword: normalized,
      keywords,
      mode,
      fetchedAt: new Date().toISOString(),
      total: merged.length,
      counts,
      sources: [{ name: '立法院開放資料即時 API ＋ 官網同步快取', count: merged.length }],
      items: merged.slice(0, 100),
    };
  }

  async function fetchStaticGov() {
    const manifest = await loadManifest();
    const govUrl = manifest?.govFile || './data/gov.json';
    const res = await fetch(`${govUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  // Render Zone 1
  function renderNewsList() {
    const filter = state.newsFilter.toLowerCase().trim();
    const filtered = state.newsItems.filter((item) => {
      if (!filter) return true;
      const hay = `${item.title} ${item.source} ${item.summary} ${(item.matchedKeywords || []).join(' ')}`.toLowerCase();
      return hay.includes(filter);
    });

    newsCountPill.textContent = `${filtered.length} 則新聞`;

    if (filtered.length === 0) {
      newsList.innerHTML = `
        <div class="state-box">
          <h3>目前沒有符合條件的新聞</h3>
          <p>若使用多關鍵字「皆須包含 (AND)」無結果，可切換為「任一符合 (OR)」擴大檢索範圍。</p>
        </div>
      `;
      return;
    }

    newsList.innerHTML = filtered
      .map((item) => {
        const safeLink = escapeHtml(item.link || '#');
        const safeSource = escapeHtml(item.source || '即時新聞');
        const timeStr = escapeHtml(formatDateDisplay(item.publishedAt));
        const highlightedTitle = highlightKeyword(item.title);
        const highlightedSummary = item.summary ? highlightKeyword(item.summary) : '';

        return `
          <article class="item-card">
            <div class="card-meta-top">
              <div class="badge-group">
                <span class="source-badge">${safeSource}</span>
              </div>
              <time class="time-text">${timeStr}</time>
            </div>
            <h3 class="card-title">
              <a href="${safeLink}" target="_blank" rel="noopener noreferrer">${highlightedTitle}</a>
            </h3>
            ${highlightedSummary ? `<p class="card-summary">${highlightedSummary}</p>` : ''}
            <div class="card-footer">
              ${renderMatchedKeywordChips(item)}
              <a class="read-more" href="${safeLink}" target="_blank" rel="noopener noreferrer">
                閱讀原文 ↗
              </a>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // Render Zone 2
  function renderLyList() {
    const filter = state.lyFilter.toLowerCase().trim();
    const cat = state.selectedLyCat;

    const filtered = state.lyItems.filter((item) => {
      if (cat !== 'all' && item.category !== cat) return false;
      if (!filter) return true;
      const hay = `${item.title} ${item.source} ${item.meta || ''} ${item.proposer || ''} ${item.summary || ''} ${(item.matchedKeywords || []).join(' ')}`.toLowerCase();
      return hay.includes(filter);
    });

    lyCountPill.textContent = `${filtered.length} 則訊息`;

    if (filtered.length === 0) {
      lyList.innerHTML = `
        <div class="state-box">
          <h3>此分類下暫無符合的立法院訊息</h3>
          <p>可切換上方分類標籤（如「全部」、「議案／法案」、「質詢發言／公報」），或將比對模式改為「任一符合 (OR)」。</p>
        </div>
      `;
      return;
    }

    lyList.innerHTML = filtered
      .map((item) => {
        const safeLink = escapeHtml(item.link || 'https://www.ly.gov.tw');
        const catClass = `cat-${escapeHtml(item.category || 'official')}`;
        const catLabel = escapeHtml(item.categoryLabel || '立法院訊息');
        const safeSource = escapeHtml(item.source || '立法院');
        const safeMeta = escapeHtml(item.meta || '');
        const timeStr = escapeHtml(formatDateDisplay(item.publishedAt));
        const highlightedTitle = highlightKeyword(item.title);
        const highlightedSummary = item.summary ? highlightKeyword(item.summary) : '';

        return `
          <article class="item-card">
            <div class="card-meta-top">
              <div class="badge-group">
                <span class="cat-badge ${catClass}">${catLabel}</span>
                <span class="meta-sub">${safeSource}</span>
              </div>
              <time class="time-text">${timeStr}</time>
            </div>
            <h3 class="card-title">
              <a href="${safeLink}" target="_blank" rel="noopener noreferrer">${highlightedTitle}</a>
            </h3>
            ${highlightedSummary ? `<p class="card-summary">${highlightedSummary}</p>` : ''}
            <div class="card-footer">
              <div class="badge-group">
                ${renderMatchedKeywordChips(item)}
                ${safeMeta ? `<span class="meta-sub">· ${safeMeta}</span>` : ''}
              </div>
              <a class="read-more" href="${safeLink}" target="_blank" rel="noopener noreferrer">
                前往檢視來源 ↗
              </a>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function updateLyCountsUI() {
    const c = state.lyCounts;
    catCountEls.all.textContent = c.all ?? 0;
    catCountEls.bill.textContent = c.bill ?? 0;
    catCountEls.interpellation.textContent = c.interpellation ?? 0;
    catCountEls.official.textContent = c.official ?? 0;
    catCountEls.press.textContent = c.press ?? 0;
  }

  function getGovItemHits(item) {
    const hay = `${item.title || ''} ${item.summary || ''} ${item.channelLabel || ''}`.toLowerCase();
    if (state.govKwMode === 'all') {
      const agKws = getActiveAgencyKeywords(item.agencyId);
      return { matched: true, hits: agKws.filter((k) => hay.includes(k.toLowerCase())) };
    }
    if (state.govKwMode === 'global') {
      const hits = state.keywords.filter((k) => hay.includes(k.toLowerCase()));
      const matched = state.mode === 'and' ? hits.length === state.keywords.length : hits.length > 0;
      return { matched, hits };
    }
    const agKws = getActiveAgencyKeywords(item.agencyId);
    if (!agKws || agKws.length === 0) {
      return { matched: true, hits: [] };
    }
    const hits = agKws.filter((k) => hay.includes(k.toLowerCase()));
    return { matched: hits.length > 0, hits };
  }

  function populateGovEditorSelect() {
    if (!state.govAgencies.length) return;
    editAgencySelect.innerHTML = state.govAgencies
      .map((ag) => {
        const customMark = isAgencyCustomized(ag.id) ? ' ✎(已自訂)' : '';
        return `<option value="${escapeHtml(ag.id)}" ${
          ag.id === state.editingAgencyId ? 'selected' : ''
        }>${escapeHtml(ag.code)} ${escapeHtml(ag.name)}${customMark}</option>`;
      })
      .join('');
  }

  function syncGovEditorBannerUI() {
    if (!state.govAgencies.length) return;
    populateGovEditorSelect();

    const ag = state.govAgencies.find((a) => a.id === state.editingAgencyId) || state.govAgencies[0];
    if (!ag) return;

    const activeKws = getActiveAgencyKeywords(ag.id);
    agencyKwInput.value = activeKws.join('、');
    govMemoHint.textContent = `原始備註：${ag.focusDesc}`;

    const chHtml = (ag.channels || [])
      .map(
        (ch) =>
          `<a class="gov-portal-btn" href="${escapeHtml(ch.url)}" target="_blank" rel="noopener noreferrer">官網：${escapeHtml(
            ch.label
          )} ↗</a>`
      )
      .join('');
    const exHtml = (ag.extraLinks || [])
      .map(
        (ex) =>
          `<a class="gov-portal-btn extra" href="${escapeHtml(ex.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            ex.label
          )} ↗</a>`
      )
      .join('');
    govChannelLinks.innerHTML = chHtml + exHtml;
  }

  function renderGovDirectoryGrid() {
    if (!state.govAgencies.length) return;
    govDirectoryGrid.innerHTML = state.govAgencies
      .map((ag) => {
        const activeKws = getActiveAgencyKeywords(ag.id).join('、');
        const customTag = isAgencyCustomized(ag.id) ? ' <small style="color:#0d9488;">(已自訂)</small>' : '';
        const chLinks = (ag.channels || [])
          .map(
            (ch) =>
              `<a class="gov-portal-btn" href="${escapeHtml(ch.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                ch.label
              )} ↗</a>`
          )
          .join('');
        const extraLinks = (ag.extraLinks || [])
          .map(
            (ex) =>
              `<a class="gov-portal-btn extra" href="${escapeHtml(ex.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                ex.label
              )} ↗</a>`
          )
          .join('');
        return `
          <div class="dir-card">
            <div class="dir-card-head">
              <span>${escapeHtml(ag.code)} ${escapeHtml(ag.name)}${customTag}</span>
            </div>
            <div class="dir-card-memo">說明：${escapeHtml(ag.focusDesc)}</div>
            <div class="dir-edit-row">
              <input
                type="text"
                class="dir-kw-input"
                data-ag="${escapeHtml(ag.id)}"
                value="${escapeHtml(activeKws)}"
                placeholder="輸入關鍵字（以 、 或 + 隔開，留空顯示全部）"
              />
              <button type="button" class="dir-apply-btn" data-apply-ag="${escapeHtml(ag.id)}">套用</button>
            </div>
            <div class="dir-card-links">${chLinks}${extraLinks}</div>
          </div>
        `;
      })
      .join('');
  }

  function renderGovSubControls() {
    const group = state.selectedGovGroup;
    const agenciesInGroup =
      group === 'all' ? state.govAgencies : state.govAgencies.filter((a) => a.groupId === group);

    const countsByAg = {};
    let groupTotal = 0;
    for (const item of state.govItems) {
      const { matched } = getGovItemHits(item);
      if (!matched) continue;
      countsByAg[item.agencyId] = (countsByAg[item.agencyId] || 0) + 1;
      if (group === 'all' || item.groupId === group) groupTotal++;
    }

    if (agenciesInGroup.length <= 1 && group !== 'all') {
      govAgencyStrip.innerHTML = '';
    } else {
      const allBtn = `<button type="button" class="gov-agency-chip ${
        state.selectedGovAgency === 'all' ? 'active' : ''
      }" data-agency="all">全部單位 <span class="chip-num">${groupTotal}</span></button>`;

      const chips = agenciesInGroup
        .map((ag) => {
          const cnt = countsByAg[ag.id] || 0;
          const isAct = state.selectedGovAgency === ag.id ? 'active' : '';
          const isCust = isAgencyCustomized(ag.id) ? 'is-customized' : '';
          return `<button type="button" class="gov-agency-chip ${isAct} ${isCust}" data-agency="${escapeHtml(
            ag.id
          )}">${escapeHtml(ag.code)} ${escapeHtml(ag.name)} <span class="chip-num">${cnt}</span></button>`;
        })
        .join('');

      govAgencyStrip.innerHTML = allBtn + chips;
    }

    syncGovEditorBannerUI();
  }

  function renderGovList() {
    renderGovDirectoryGrid();
    renderGovSubControls();

    const textFilter = state.govFilter.toLowerCase().trim();
    const evaluated = [];

    for (const item of state.govItems) {
      if (state.selectedGovGroup !== 'all' && item.groupId !== state.selectedGovGroup) continue;
      if (state.selectedGovAgency !== 'all' && item.agencyId !== state.selectedGovAgency) continue;

      const { matched, hits } = getGovItemHits(item);
      if (!matched) continue;

      if (textFilter) {
        const hay = `${item.agencyName} ${item.code} ${item.channelLabel} ${item.officialHost || ''} ${item.title} ${
          item.summary || ''
        } ${hits.join(' ')}`.toLowerCase();
        if (!hay.includes(textFilter)) continue;
      }

      evaluated.push({ item, hits });
    }

    govCountPill.textContent = `${evaluated.length} 則官網公告`;

    if (evaluated.length === 0) {
      govList.innerHTML = `
        <div class="state-box">
          <h3>目前篩選條件下暫無符合的官網訊息</h3>
          <p>該機關近期最新官網公告可能尚未出現上述關鍵字。您可以直接在上方編輯框修改監測關鍵字並點擊「套用並儲存」，或切換至「📋 顯示全部官網最新公告」檢視該機關所有最新發布內容。</p>
        </div>
      `;
      return;
    }

    govList.innerHTML = evaluated
      .slice(0, 140)
      .map(({ item, hits }) => {
        const safeLink = escapeHtml(item.link || item.channelUrl || '#');
        const agencyLabel = `${escapeHtml(item.code)} ${escapeHtml(item.agencyName)}`;
        const channelLabel = escapeHtml(item.channelLabel || '官網公告');
        const hostBadge = item.officialHost
          ? `<span class="gov-host-badge" title="官方網站網域">${escapeHtml(item.officialHost)}</span>`
          : '';
        const timeStr = escapeHtml(formatDateDisplay(item.publishedAt));

        const highlightTerms =
          state.govKwMode === 'global'
            ? state.keywords
            : hits.length > 0
            ? hits
            : getActiveAgencyKeywords(item.agencyId);

        const highlightedTitle = highlightKeyword(item.title, highlightTerms);
        const highlightedSummary = item.summary ? highlightKeyword(item.summary, highlightTerms) : '';

        let specialHtml = '';
        if (item.specialBadge?.label) {
          const cls = `special-${escapeHtml(item.specialBadge.type || 'regulation')}`;
          specialHtml = `<span class="special-badge ${cls}">${escapeHtml(item.specialBadge.label)}</span>`;
        }

        const kwChips = hits
          .slice(0, 6)
          .map((k) => `<span class="kw-hit-chip">#${escapeHtml(k)}</span>`)
          .join('');

        return `
          <article class="item-card">
            <div class="card-meta-top">
              <div class="badge-group">
                <span class="gov-agency-badge">${agencyLabel}</span>
                <span class="meta-sub">${channelLabel}</span>
                ${hostBadge}
                ${specialHtml}
              </div>
              <time class="time-text">${timeStr}</time>
            </div>
            <h3 class="card-title">
              <a href="${safeLink}" target="_blank" rel="noopener noreferrer">${highlightedTitle}</a>
            </h3>
            ${highlightedSummary ? `<p class="card-summary">${highlightedSummary}</p>` : ''}
            <div class="card-footer">
              <div class="kw-hit-badges">
                ${kwChips || `<span class="meta-sub">官網最新公告</span>`}
              </div>
              <a class="read-more" href="${safeLink}" target="_blank" rel="noopener noreferrer">
                前往官網原文 ↗
              </a>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function applyZoneView(view) {
    state.viewZone = view;
    zoneViewSwitcher.querySelectorAll('.view-chip').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === 'all') {
      dashboardGrid.classList.remove('single-zone-mode');
      zone1Panel.classList.remove('hidden');
      zone2Panel.classList.remove('hidden');
      zone3Panel.classList.remove('hidden');
    } else {
      dashboardGrid.classList.add('single-zone-mode');
      zone1Panel.classList.toggle('hidden', view !== 'zone1');
      zone2Panel.classList.toggle('hidden', view !== 'zone2');
      zone3Panel.classList.toggle('hidden', view !== 'zone3');
    }
  }

  async function fetchAllData(forceRefresh = false, skipGovIfLoaded = false) {
    if (state.loading) return;
    state.loading = true;
    refreshBtn.classList.add('loading');

    updateKeywordBadgesUI();

    if (state.newsItems.length === 0) showSkeletons(newsList, 4);
    if (state.lyItems.length === 0) showSkeletons(lyList, 4);
    const shouldFetchGov = !skipGovIfLoaded || state.govItems.length === 0;
    if (shouldFetchGov && state.govItems.length === 0) showSkeletons(govList, 6);

    const kwLabel = state.keywords.map((k) => `【${k}】`).join(state.mode === 'and' ? ' AND ' : ' OR ');
    lastSyncText.textContent = `正在搜尋 ${kwLabel} 最新新聞與國會資料…`;

    const hasApi = await detectBackendMode();
    const qs = `q=${encodeURIComponent(state.keyword)}&mode=${encodeURIComponent(state.mode)}${
      forceRefresh ? '&refresh=1' : ''
    }`;

    const tasks = [
      hasApi ? fetch(`./api/news?${qs}`).then((r) => r.json()) : fetchStaticNews(state.keywords, state.mode, forceRefresh),
      hasApi ? fetch(`./api/ly?${qs}`).then((r) => r.json()) : fetchStaticLy(state.keywords, state.mode, forceRefresh),
    ];

    if (shouldFetchGov) {
      tasks.push(
        hasApi
          ? fetch(`./api/gov${forceRefresh ? '?refresh=1' : ''}`).then((r) => r.json())
          : fetchStaticGov()
      );
    }

    const settled = await Promise.allSettled(tasks);
    const [newsRes, lyRes, govRes] = settled;

    if (newsRes.status === 'fulfilled' && !newsRes.value.error) {
      const data = newsRes.value;
      state.newsItems = data.items || [];
      const srcDesc = (data.sources || []).map((s) => `${s.name} (${s.count})`).join(' ＋ ');
      newsSourcesSummary.textContent = srcDesc ? `來源：${srcDesc}` : '即時新聞索引';
      renderNewsList();
    } else {
      newsList.innerHTML = `<div class="state-box"><h3>即時新聞抓取失敗</h3><p>請稍後點擊右上角重新整理。</p></div>`;
    }

    if (lyRes.status === 'fulfilled' && !lyRes.value.error) {
      const data = lyRes.value;
      state.lyItems = data.items || [];
      state.lyCounts = data.counts || { all: state.lyItems.length, bill: 0, interpellation: 0, official: 0, press: 0 };
      updateLyCountsUI();
      const activeSrcCount = (data.sources || []).filter((s) => s.count > 0).length;
      lySourcesSummary.textContent = hasApi
        ? `已同步 ${activeSrcCount || (data.sources || []).length} 項立法院資料管道`
        : '已連線立法院開放資料 API 與自動排程快照';
      renderLyList();
    } else {
      lyList.innerHTML = `<div class="state-box"><h3>立法院資料抓取失敗</h3><p>請稍後點擊右上角重新整理。</p></div>`;
    }

    if (shouldFetchGov && govRes) {
      if (govRes.status === 'fulfilled' && !govRes.value.error) {
        const gData = govRes.value;
        state.govAgencies = gData.agencies || [];
        state.govItems = gData.items || [];
        if (!state.govAgencies.some((a) => a.id === state.editingAgencyId) && state.govAgencies[0]) {
          state.editingAgencyId = state.govAgencies[0].id;
        }
        govSourcesSummary.textContent = `100% 官網直連｜共收錄 ${state.govAgencies.length} 個機關、${state.govItems.length} 則最新官方公告`;
        renderGovList();
      } else {
        govList.innerHTML = `<div class="state-box"><h3>政府機關專區載入失敗</h3><p>請稍後再試。</p></div>`;
      }
    } else if (state.govKwMode === 'global') {
      renderGovList();
    }

    const syncDate =
      newsRes.status === 'fulfilled' && newsRes.value?.fetchedAt
        ? new Date(newsRes.value.fetchedAt)
        : new Date();
    const timeFormatted = syncDate.toLocaleTimeString('zh-TW', { hour12: false });
    lastSyncText.textContent = `最後更新：${timeFormatted}（${kwLabel}）`;

    state.countdown = AUTO_REFRESH_SECONDS;
    state.loading = false;
    refreshBtn.classList.remove('loading');
  }

  function applyNewKeywordSearch(rawVal, forceRefresh = true) {
    const uiMode = matchModeSelect.value === 'and' ? 'and' : 'or';
    const parsed = parseSearchExpression(rawVal, uiMode);
    state.keywords = parsed.keywords;
    state.keyword = parsed.normalized;
    state.mode = parsed.mode;

    // Sync input & dropdown UI if user typed inline OR / AND
    matchModeSelect.value = state.mode;
    keywordInput.value = state.keyword;

    quickChips.forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.kw === state.keyword);
    });

    state.newsItems = [];
    state.lyItems = [];
    fetchAllData(forceRefresh, true);
  }

  // Event Listeners
  zoneViewSwitcher.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-chip');
    if (!btn) return;
    applyZoneView(btn.dataset.view || 'all');
  });

  keywordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    applyNewKeywordSearch(keywordInput.value, true);
  });

  matchModeSelect.addEventListener('change', () => {
    // Re-parse using current input text (stripping any old inline OR/AND by using state.keywords.join('+'))
    state.mode = matchModeSelect.value === 'and' ? 'and' : 'or';
    const currentInput = parseSearchExpression(keywordInput.value, state.mode);
    state.keywords = currentInput.keywords;
    state.keyword = currentInput.normalized;
    // Respect explicit dropdown selection
    state.mode = matchModeSelect.value === 'and' ? 'and' : 'or';
    keywordInput.value = state.keyword;

    if (state.keywords.length > 1) {
      state.newsItems = [];
      state.lyItems = [];
      fetchAllData(false, true);
    } else if (state.govKwMode === 'global') {
      renderGovList();
    }
  });

  quickChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      applyNewKeywordSearch(chip.dataset.kw || '水資源', false);
    });
  });

  refreshBtn.addEventListener('click', () => {
    fetchAllData(true, false);
  });

  newsFilterInput.addEventListener('input', (e) => {
    state.newsFilter = e.target.value;
    renderNewsList();
  });

  lyFilterInput.addEventListener('input', (e) => {
    state.lyFilter = e.target.value;
    renderLyList();
  });

  lyCategoryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    state.selectedLyCat = btn.dataset.cat || 'all';
    lyCategoryTabs.querySelectorAll('.cat-tab').forEach((t) => t.classList.toggle('active', t === btn));
    renderLyList();
  });

  govGroupTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.gov-group-tab');
    if (!btn) return;
    const grp = btn.dataset.group || 'all';
    state.selectedGovGroup = grp;
    state.selectedGovAgency = 'all';
    if (grp !== 'all') {
      const firstInGroup = state.govAgencies.find((a) => a.groupId === grp);
      if (firstInGroup) state.editingAgencyId = firstInGroup.id;
    }
    govGroupTabs.querySelectorAll('.gov-group-tab').forEach((t) => t.classList.toggle('active', t === btn));
    renderGovList();
  });

  govAgencyStrip.addEventListener('click', (e) => {
    const btn = e.target.closest('.gov-agency-chip');
    if (!btn) return;
    const agId = btn.dataset.agency || 'all';
    state.selectedGovAgency = agId;
    if (agId !== 'all') {
      state.editingAgencyId = agId;
    }
    renderGovList();
  });

  editAgencySelect.addEventListener('change', () => {
    state.editingAgencyId = editAgencySelect.value;
    syncGovEditorBannerUI();
  });

  govKwEditorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const targetId = editAgencySelect.value || state.editingAgencyId;
    if (!targetId) return;
    const parsedKws = parseGovFocusInput(agencyKwInput.value);
    state.customGovKeywords[targetId] = parsedKws;
    persistCustomGovKeywords();

    if (state.govKwMode !== 'preset') {
      state.govKwMode = 'preset';
      govKwRadios.forEach((r) => {
        r.checked = r.value === 'preset';
      });
    }

    renderGovList();
    flashGovToast(
      parsedKws.length > 0
        ? `✓ 已套用並儲存（共 ${parsedKws.length} 個關鍵字）`
        : '✓ 已套用（未設限關鍵字，顯示該機關全部公告）'
    );
  });

  resetAgencyKwBtn.addEventListener('click', () => {
    const targetId = editAgencySelect.value || state.editingAgencyId;
    if (!targetId) return;
    delete state.customGovKeywords[targetId];
    persistCustomGovKeywords();
    renderGovList();
    flashGovToast('↺ 已還原為預設監測關鍵字');
  });

  resetAllGovKwBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.customGovKeywords = {};
    persistCustomGovKeywords();
    renderGovList();
    flashGovToast('↺ 已將全部 20 個機關還原為預設值');
  });

  govDirectoryGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.dir-apply-btn');
    if (!btn) return;
    const agId = btn.dataset.applyAg;
    const input = govDirectoryGrid.querySelector(`.dir-kw-input[data-ag="${CSS.escape(agId)}"]`);
    if (!agId || !input) return;

    const parsedKws = parseGovFocusInput(input.value);
    state.customGovKeywords[agId] = parsedKws;
    state.editingAgencyId = agId;
    persistCustomGovKeywords();

    if (state.govKwMode !== 'preset') {
      state.govKwMode = 'preset';
      govKwRadios.forEach((r) => {
        r.checked = r.value === 'preset';
      });
    }

    renderGovList();
    flashGovToast(`✓ 已套用 ${agId} 監測關鍵字`);
  });

  govKwRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.govKwMode = e.target.value;
        renderGovList();
      }
    });
  });

  govFilterInput.addEventListener('input', (e) => {
    state.govFilter = e.target.value;
    renderGovList();
  });

  setInterval(() => {
    if (!autoRefreshToggle.checked) {
      countdownText.textContent = '(已暫停)';
      return;
    }
    if (state.loading) return;

    state.countdown = Math.max(0, state.countdown - 1);
    const mins = String(Math.floor(state.countdown / 60)).padStart(2, '0');
    const secs = String(state.countdown % 60).padStart(2, '0');
    countdownText.textContent = `(${mins}:${secs})`;

    if (state.countdown === 0) {
      fetchAllData(true, false);
    }
  }, 1000);

  fetchAllData(false, false);
})();
