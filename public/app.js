(() => {
  const AUTO_REFRESH_SECONDS = 300; // 5 minutes

  const state = {
    keyword: '水資源',
    keywords: ['水資源'],
    mode: 'or', // 'or' = 任一符合 (同時搜尋多個關鍵字並合併), 'and' = 皆須包含
    newsItems: [],
    lyItems: [],
    lyCounts: { all: 0, bill: 0, interpellation: 0, official: 0, press: 0 },
    selectedLyCat: 'all',
    newsFilter: '',
    lyFilter: '',
    countdown: AUTO_REFRESH_SECONDS,
    loading: false,
    hasBackendApi: null,
    manifest: null,
  };

  // Elements
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
   * Parse '+' or '＋' separated keywords
   */
  function parseKeywordList(raw = '水資源') {
    const parts = String(raw || '')
      .split(/[+＋]+/)
      .map((t) => t.replace(/"/g, '').trim())
      .filter(Boolean);
    const unique = [...new Set(parts)];
    return unique.length > 0 ? unique.slice(0, 8) : ['水資源'];
  }

  function buildExactPhraseQuery(keywords) {
    const list = Array.isArray(keywords) ? keywords : parseKeywordList(keywords);
    return list.map((t) => `"${t}"`).join(' ');
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
    const list = Array.isArray(keywords) ? keywords : parseKeywordList(keywords);
    const tokens = list
      .map((t) => t.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length) // highlight longer phrases first
      .map((t) => escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (tokens.length === 0) return escaped;
    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    return escaped.replace(regex, '<mark class="kw-mark">$1</mark>');
  }

  function updateKeywordBadgesUI() {
    const kws = state.keywords;
    const modeLabel =
      kws.length > 1 ? (state.mode === 'and' ? '（且）' : '（或）') : '';

    activeKeywordBadge.innerHTML = kws
      .map((k) => `<strong class="active-keyword-pill">【${escapeHtml(k)}】</strong>`)
      .join(`<span class="kw-plus-sep">＋</span>`);

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

  function showSkeletons(container) {
    container.innerHTML = Array.from({ length: 4 })
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

  function parseBrowserRssXml(xmlText, fallbackSource = '台灣新聞') {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const nodes = Array.from(doc.querySelectorAll('item'));
    return nodes
      .map((node) => {
        let rawTitle = (node.querySelector('title')?.textContent || '').trim();
        let link = (node.querySelector('link')?.textContent || '').trim();
        const pubDateRaw = (node.querySelector('pubDate')?.textContent || '').trim();
        let source = (node.querySelector('source')?.textContent || '').trim();

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

        let summary = stripHtmlText(node.querySelector('description')?.textContent || '');
        if (summary && rawTitle && summary.startsWith(rawTitle)) {
          summary = summary.slice(rawTitle.length).replace(/^[\s\-—·|]+/, '').trim();
        }
        if (source && summary === source) summary = '';

        const dt = pubDateRaw ? new Date(pubDateRaw) : null;
        const validDt = dt && !Number.isNaN(dt.getTime()) ? dt : null;
        if (!rawTitle) return null;

        return {
          title: rawTitle,
          link: link || '#',
          source: source || fallbackSource,
          summary: summary.slice(0, 220),
          publishedAt: validDt ? validDt.toISOString() : null,
          timestamp: validDt ? validDt.getTime() : 0,
        };
      })
      .filter(Boolean);
  }

  async function fetchBrowserLiveRss(rssUrl) {
    const proxies = [
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rssUrl)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(rssUrl)}`,
    ];
    for (const p of proxies) {
      try {
        const res = await fetch(p, { signal: AbortSignal.timeout(7000) });
        if (res.ok) {
          const txt = await res.text();
          if (txt.includes('<item>')) return parseBrowserRssXml(txt);
        }
      } catch (_) {}
    }
    return [];
  }

  // Static Mode Zone 1 supporting '+' separated multi-keywords & OR/AND mode
  async function fetchStaticNews(keywords, mode, forceRefresh) {
    const normalized = keywords.join('+');
    const manifest = await loadManifest();

    // Direct exact preset match in manifest (when mode === 'or' or single keyword)
    if (!forceRefresh && (mode === 'or' || keywords.length === 1)) {
      const exactPreset = manifest?.presets?.[normalized];
      if (exactPreset?.newsFile) {
        try {
          const res = await fetch(`${exactPreset.newsFile}?t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) return await res.json();
        } catch (_) {}
      }
    }

    // Load any matching individual keyword snapshots from manifest
    const snapshotPool = [];
    if (manifest?.presets) {
      const candidateKeys = new Set([...keywords, '水資源', '水資源+水庫', '水資源+再生水', '水資源+海水淡化']);
      const fetches = [...candidateKeys]
        .filter((k) => manifest.presets[k]?.newsFile)
        .map(async (k) => {
          try {
            const r = await fetch(`${manifest.presets[k].newsFile}?t=${Date.now()}`);
            if (r.ok) {
              const j = await r.json();
              return (j.items || []).map((it) => ({
                ...it,
                matchedKeywords: computeMatchedKeywords(it, keywords),
              }));
            }
          } catch (_) {}
          return [];
        });
      const chunks = await Promise.all(fetches);
      chunks.forEach((c) => snapshotPool.push(...c));
    }

    // Fetch live RSS per keyword (OR) or combined exact query (AND)
    let liveItems = [];
    if (keywords.length === 1 || mode === 'and') {
      const exactQuery = buildExactPhraseQuery(keywords);
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(exactQuery)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
      const fetched = await fetchBrowserLiveRss(url);
      liveItems = fetched.map((it) => ({
        ...it,
        matchedKeywords: computeMatchedKeywords(it, keywords, keywords.length === 1 ? keywords[0] : ''),
      }));
    } else {
      const perKw = await Promise.all(
        keywords.map(async (kw) => {
          const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`"${kw}"`)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
          const list = await fetchBrowserLiveRss(url);
          return list.map((it) => ({
            ...it,
            matchedKeywords: computeMatchedKeywords(it, keywords, kw),
          }));
        })
      );
      perKw.forEach((arr) => liveItems.push(...arr));
    }

    // Filter snapshotPool to match current keywords & mode
    const filteredPool = snapshotPool.filter((it) => {
      const hay = `${it.title || ''} ${it.summary || ''} ${it.source || ''}`.toLowerCase();
      return mode === 'and'
        ? keywords.every((k) => hay.includes(k.toLowerCase()))
        : keywords.some((k) => hay.includes(k.toLowerCase()));
    });

    const merged = deduplicateItems([...liveItems, ...filteredPool]).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );

    return {
      keyword: normalized,
      keywords,
      mode,
      fetchedAt: new Date().toISOString(),
      total: merged.length,
      sources: [
        {
          name: liveItems.length > 0 ? 'Google 新聞即時多關鍵字檢索' : 'GitHub Pages 多關鍵字同步資料庫',
          count: merged.length,
        },
      ],
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

  // Browser-direct live query to LYAPI v2 for a single exact query string
  async function fetchLiveLySingleExact(exactQueryStr, allKeywords, fallbackKw = '') {
    const exact = encodeURIComponent(exactQueryStr);
    const settled = await Promise.allSettled([
      fetch(`https://v2.ly.govapi.tw/bills?q=${exact}&limit=20`).then((r) => r.json()),
      fetch(`https://v2.ly.govapi.tw/ivods?q=${exact}&%E5%BD%B1%E7%89%87%E7%A8%AE%E9%A1%9E=Clip&limit=15`).then((r) => r.json()),
      fetch(`https://v2.ly.govapi.tw/gazette_agendas?q=${exact}&limit=12`).then((r) => r.json()),
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

  // Static Mode Zone 2 supporting '+' separated multi-keywords & OR/AND mode
  async function fetchStaticLy(keywords, mode, forceRefresh) {
    const normalized = keywords.join('+');
    const manifest = await loadManifest();

    if (!forceRefresh && (mode === 'or' || keywords.length === 1)) {
      const exactPreset = manifest?.presets?.[normalized];
      if (exactPreset?.lyFile) {
        try {
          const res = await fetch(`${exactPreset.lyFile}?t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) return await res.json();
        } catch (_) {}
      }
    }

    // Gather matching official/press items from pre-built snapshots
    const snapshotPool = [];
    if (manifest?.presets) {
      const candidateKeys = new Set([...keywords, '水資源', '水資源+水庫', '水資源+再生水', '水資源+海水淡化']);
      const fetches = [...candidateKeys]
        .filter((k) => manifest.presets[k]?.lyFile)
        .map(async (k) => {
          try {
            const r = await fetch(`${manifest.presets[k].lyFile}?t=${Date.now()}`);
            if (r.ok) {
              const j = await r.json();
              return j.items || [];
            }
          } catch (_) {}
          return [];
        });
      const chunks = await Promise.all(fetches);
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

    // Live browser CORS query to v2.ly.govapi.tw for ALL keywords!
    let liveLyItems = [];
    if (keywords.length === 1 || mode === 'and') {
      liveLyItems = await fetchLiveLySingleExact(
        buildExactPhraseQuery(keywords),
        keywords,
        keywords.length === 1 ? keywords[0] : ''
      );
    } else {
      const perKw = await Promise.all(
        keywords.map((kw) => fetchLiveLySingleExact(`"${kw}"`, keywords, kw))
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
      sources: [{ name: '立法院開放資料多關鍵字即時 API ＋ 官網同步快取', count: merged.length }],
      items: merged.slice(0, 100),
    };
  }

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

  async function fetchAllData(forceRefresh = false) {
    if (state.loading) return;
    state.loading = true;
    refreshBtn.classList.add('loading');

    state.keywords = parseKeywordList(state.keyword);
    state.keyword = state.keywords.join('+');
    keywordInput.value = state.keyword;
    updateKeywordBadgesUI();

    if (state.newsItems.length === 0) showSkeletons(newsList);
    if (state.lyItems.length === 0) showSkeletons(lyList);

    const kwLabel = state.keywords.map((k) => `【${k}】`).join('＋');
    lastSyncText.textContent = `正在同時搜尋 ${kwLabel} 最新新聞與立法院資料…`;

    const hasApi = await detectBackendMode();
    const qs = `q=${encodeURIComponent(state.keyword)}&mode=${encodeURIComponent(state.mode)}${
      forceRefresh ? '&refresh=1' : ''
    }`;

    const [newsRes, lyRes] = await Promise.allSettled(
      hasApi
        ? [
            fetch(`./api/news?${qs}`).then((r) => r.json()),
            fetch(`./api/ly?${qs}`).then((r) => r.json()),
          ]
        : [
            fetchStaticNews(state.keywords, state.mode, forceRefresh),
            fetchStaticLy(state.keywords, state.mode, forceRefresh),
          ]
    );

    if (newsRes.status === 'fulfilled' && !newsRes.value.error) {
      const data = newsRes.value;
      state.newsItems = data.items || [];
      const srcDesc = (data.sources || [])
        .map((s) => `${s.name} (${s.count})`)
        .join(' ＋ ');
      newsSourcesSummary.textContent = srcDesc ? `來源：${srcDesc}` : '即時新聞索引';
      renderNewsList();
    } else {
      newsList.innerHTML = `
        <div class="state-box">
          <h3>即時新聞抓取失敗</h3>
          <p>${escapeHtml(newsRes.reason?.message || newsRes.value?.detail || '請檢查網路連線後重試')}</p>
        </div>
      `;
    }

    if (lyRes.status === 'fulfilled' && !lyRes.value.error) {
      const data = lyRes.value;
      state.lyItems = data.items || [];
      state.lyCounts = data.counts || {
        all: state.lyItems.length,
        bill: 0,
        interpellation: 0,
        official: 0,
        press: 0,
      };
      updateLyCountsUI();
      const activeSrcCount = (data.sources || []).filter((s) => s.count > 0).length;
      lySourcesSummary.textContent = hasApi
        ? `已同步 ${activeSrcCount || (data.sources || []).length} 項立法院資料管道`
        : '已連線立法院開放資料多關鍵字 API 與自動排程快照';
      renderLyList();
    } else {
      lyList.innerHTML = `
        <div class="state-box">
          <h3>立法院資料抓取失敗</h3>
          <p>${escapeHtml(lyRes.reason?.message || lyRes.value?.detail || '請檢查網路連線後重試')}</p>
        </div>
      `;
    }

    const syncDate =
      newsRes.status === 'fulfilled' && newsRes.value?.fetchedAt
        ? new Date(newsRes.value.fetchedAt)
        : new Date();
    const timeFormatted = syncDate.toLocaleTimeString('zh-TW', { hour12: false });
    const modeDesc =
      state.keywords.length > 1
        ? state.mode === 'and'
          ? '｜皆須包含'
          : '｜任一符合'
        : '';
    lastSyncText.textContent = `資料更新時間：${timeFormatted}（${kwLabel}${modeDesc}）`;

    state.countdown = AUTO_REFRESH_SECONDS;
    state.loading = false;
    refreshBtn.classList.remove('loading');
  }

  function applyNewKeywordSearch(rawVal, forceRefresh = true) {
    const parsed = parseKeywordList(rawVal);
    state.keywords = parsed;
    state.keyword = parsed.join('+');
    state.mode = matchModeSelect.value === 'and' ? 'and' : 'or';
    keywordInput.value = state.keyword;

    quickChips.forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.kw === state.keyword);
    });

    state.newsItems = [];
    state.lyItems = [];
    fetchAllData(forceRefresh);
  }

  // Event Listeners
  keywordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    applyNewKeywordSearch(keywordInput.value, true);
  });

  matchModeSelect.addEventListener('change', () => {
    state.mode = matchModeSelect.value === 'and' ? 'and' : 'or';
    if (state.keywords.length > 1) {
      state.newsItems = [];
      state.lyItems = [];
      fetchAllData(false);
    }
  });

  quickChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const kw = chip.dataset.kw || '水資源';
      applyNewKeywordSearch(kw, false);
    });
  });

  refreshBtn.addEventListener('click', () => {
    fetchAllData(true);
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
      fetchAllData(true);
    }
  }, 1000);

  fetchAllData(false);
})();
