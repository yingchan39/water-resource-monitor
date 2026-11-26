(() => {
  const AUTO_REFRESH_SECONDS = 300; // 5 minutes

  const state = {
    keyword: '水資源',
    newsItems: [],
    lyItems: [],
    lyCounts: { all: 0, bill: 0, interpellation: 0, official: 0, press: 0 },
    selectedLyCat: 'all',
    newsFilter: '',
    lyFilter: '',
    countdown: AUTO_REFRESH_SECONDS,
    loading: false,
    hasBackendApi: null, // null = unknown, true = Node server, false = GitHub Pages static mode
    manifest: null,
  };

  // Elements
  const keywordForm = document.getElementById('keywordForm');
  const keywordInput = document.getElementById('keywordInput');
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

  function buildExactPhraseQuery(keyword = '水資源') {
    const tokens = String(keyword)
      .split(/\s+/)
      .map((t) => t.replace(/"/g, '').trim())
      .filter(Boolean);
    return tokens.length ? tokens.map((t) => `"${t}"`).join(' ') : '"水資源"';
  }

  function deduplicateItems(items) {
    const seen = new Set();
    const out = [];
    for (const item of items) {
      const key = String(item.title || '')
        .toLowerCase()
        .replace(/[\s\p{P}\p{S}]+/gu, '')
        .slice(0, 44);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  function highlightKeyword(text = '', keyword = state.keyword) {
    const escaped = escapeHtml(text);
    if (!keyword) return escaped;
    const tokens = keyword
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (tokens.length === 0) return escaped;
    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    return escaped.replace(regex, '<mark class="kw-mark">$1</mark>');
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

  // Detect whether Node backend (/api/health) is running or if hosted statically on GitHub Pages
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

  // Parse RSS XML directly in the browser via DOMParser
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

  // Fetch RSS in static browser mode via CORS relay if needed
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

  // Static Mode Zone 1: Load GitHub Actions snapshot + optional live browser RSS supplement
  async function fetchStaticNews(keyword, forceRefresh) {
    const manifest = await loadManifest();
    const presetEntry = manifest?.presets?.[keyword];
    let snapshotData = null;

    if (presetEntry?.newsFile) {
      try {
        const res = await fetch(`${presetEntry.newsFile}?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) snapshotData = await res.json();
      } catch (_) {}
    }

    if (snapshotData && !forceRefresh) {
      return snapshotData;
    }

    // Try live RSS fetch in browser (for custom keywords or manual forceRefresh)
    const exactQuery = buildExactPhraseQuery(keyword);
    const googleRss = `https://news.google.com/rss/search?q=${encodeURIComponent(exactQuery)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
    const liveItems = await fetchBrowserLiveRss(googleRss);

    if (liveItems.length > 0) {
      const merged = deduplicateItems([...liveItems, ...(snapshotData?.items || [])]).sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );
      return {
        keyword,
        fetchedAt: new Date().toISOString(),
        total: merged.length,
        sources: [{ name: 'Google 新聞即時檢索', count: merged.length }],
        items: merged.slice(0, 60),
      };
    }

    if (snapshotData) return snapshotData;

    // Fallback: filter default snapshot by keyword tokens
    const defaultFile = manifest?.presets?.['水資源']?.newsFile || './data/news-default.json';
    const fallbackRes = await fetch(`${defaultFile}?t=${Date.now()}`);
    const fallbackJson = await fallbackRes.json();
    const tokens = keyword.toLowerCase().split(/\s+/).filter(Boolean);
    const matched = (fallbackJson.items || []).filter((it) => {
      const hay = `${it.title} ${it.summary || ''} ${it.source || ''}`.toLowerCase();
      return tokens.every((tk) => hay.includes(tk));
    });
    return {
      keyword,
      fetchedAt: fallbackJson.fetchedAt,
      total: matched.length,
      sources: [{ name: 'GitHub Pages 同步快取', count: matched.length }],
      items: matched,
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

  // Browser-direct live query to LYAPI v2 (supports CORS natively: Access-Control-Allow-Origin: *)
  async function fetchLiveLyApiInBrowser(keyword) {
    const exact = encodeURIComponent(buildExactPhraseQuery(keyword));
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

        items.push({
          category: 'bill',
          categoryLabel: '議案／法案',
          title,
          link: b.url || `https://ppg.ly.gov.tw/ppg/bills/${encodeURIComponent(b['議案編號'] || '')}/details`,
          source: `立法院・${b['議案類別'] || '議案提案'}`,
          meta: [b['屆'] ? `第${b['屆']}屆` : '', b['會期'] ? `第${b['會期']}會期` : '', status]
            .filter(Boolean)
            .join(' · '),
          proposer,
          summary: [proposer ? `提案：${proposer}` : '', status ? `進度：${status}` : '', snippet ? `摘要：${snippet}` : '']
            .filter(Boolean)
            .join(' ｜ ')
            .slice(0, 260),
          publishedAt: dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null,
          timestamp: dt && !Number.isNaN(dt.getTime()) ? dt.getTime() : 0,
        });
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

        items.push({
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
        });
      }
    }

    if (settled[2].status === 'fulfilled') {
      const agendas = settled[2].value?.gazetteagendas || settled[2].value?.agendas || [];
      for (const g of agendas) {
        const subject = stripHtmlText(g['案由'] || '');
        if (!subject) continue;
        const dRaw = Array.isArray(g['會議日期']) ? g['會議日期'][0] : g['會議日期'];
        const dt = dRaw ? new Date(dRaw) : null;
        items.push({
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
        });
      }
    }

    return items;
  }

  // Static Mode Zone 2: Combine GitHub Actions snapshot (ly.gov.tw official reports/press) + live LYAPI v2 CORS query
  async function fetchStaticLy(keyword, forceRefresh) {
    const manifest = await loadManifest();
    const presetEntry = manifest?.presets?.[keyword];
    let snapshotData = null;

    if (presetEntry?.lyFile) {
      try {
        const res = await fetch(`${presetEntry.lyFile}?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) snapshotData = await res.json();
      } catch (_) {}
    }

    if (snapshotData && !forceRefresh) {
      return snapshotData;
    }

    // Live query to v2.ly.govapi.tw directly from browser!
    const liveLyItems = await fetchLiveLyApiInBrowser(keyword);
    const merged = deduplicateItems([...liveLyItems, ...(snapshotData?.items || [])]).sort(
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
      keyword,
      fetchedAt: new Date().toISOString(),
      total: merged.length,
      counts,
      sources: [{ name: '立法院開放資料即時 API ＋ 官網同步快取', count: merged.length }],
      items: merged.slice(0, 80),
    };
  }

  function renderNewsList() {
    const filter = state.newsFilter.toLowerCase().trim();
    const filtered = state.newsItems.filter((item) => {
      if (!filter) return true;
      const hay = `${item.title} ${item.source} ${item.summary}`.toLowerCase();
      return hay.includes(filter);
    });

    newsCountPill.textContent = `${filtered.length} 則新聞`;

    if (filtered.length === 0) {
      newsList.innerHTML = `
        <div class="state-box">
          <h3>目前沒有符合條件的新聞</h3>
          <p>請嘗試調整篩選字詞，或點擊右上角「立即抓取最新」重新同步。</p>
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
              <span class="meta-sub">關鍵字：${escapeHtml(state.keyword)}</span>
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
      const hay = `${item.title} ${item.source} ${item.meta || ''} ${item.proposer || ''} ${item.summary || ''}`.toLowerCase();
      return hay.includes(filter);
    });

    lyCountPill.textContent = `${filtered.length} 則訊息`;

    if (filtered.length === 0) {
      lyList.innerHTML = `
        <div class="state-box">
          <h3>此分類下暫無符合的立法院訊息</h3>
          <p>可切換上方分類標籤（如「全部」、「議案／法案」、「質詢發言／公報」）檢視其他立法院公開紀錄。</p>
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
              <span class="meta-sub">${safeMeta || `關鍵字：${escapeHtml(state.keyword)}`}</span>
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

    const kw = state.keyword;
    activeKeywordBadge.textContent = `【${kw}】`;
    kwInlines.forEach((el) => {
      el.textContent = `【${kw}】`;
    });

    if (state.newsItems.length === 0) showSkeletons(newsList);
    if (state.lyItems.length === 0) showSkeletons(lyList);

    lastSyncText.textContent = `正在即時抓取「${kw}」最新新聞與立法院資料…`;

    const hasApi = await detectBackendMode();
    const qs = `q=${encodeURIComponent(kw)}${forceRefresh ? '&refresh=1' : ''}`;

    const [newsRes, lyRes] = await Promise.allSettled(
      hasApi
        ? [
            fetch(`./api/news?${qs}`).then((r) => r.json()),
            fetch(`./api/ly?${qs}`).then((r) => r.json()),
          ]
        : [
            fetchStaticNews(kw, forceRefresh),
            fetchStaticLy(kw, forceRefresh),
          ]
    );

    // Handle Zone 1
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

    // Handle Zone 2
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
        : '已連線立法院開放資料 API 與自動排程快照';
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
      (newsRes.status === 'fulfilled' && newsRes.value?.fetchedAt
        ? new Date(newsRes.value.fetchedAt)
        : new Date());
    const timeFormatted = syncDate.toLocaleTimeString('zh-TW', { hour12: false });
    lastSyncText.textContent = `資料更新時間：${timeFormatted}（關鍵字：【${kw}】）`;

    state.countdown = AUTO_REFRESH_SECONDS;
    state.loading = false;
    refreshBtn.classList.remove('loading');
  }

  // Event Listeners
  keywordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = keywordInput.value.trim() || '水資源';
    keywordInput.value = val;
    state.keyword = val;
    quickChips.forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.kw === val);
    });
    state.newsItems = [];
    state.lyItems = [];
    fetchAllData(true);
  });

  quickChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const kw = chip.dataset.kw || '水資源';
      keywordInput.value = kw;
      state.keyword = kw;
      quickChips.forEach((c) => c.classList.toggle('active', c === chip));
      state.newsItems = [];
      state.lyItems = [];
      fetchAllData(false);
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
