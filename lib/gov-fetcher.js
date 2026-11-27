const { URL } = require('node:url');

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
};

const GOV_GROUPS = [
  { id: 'all', label: '全部機關' },
  { id: '3-1', label: '3-1 總統府' },
  { id: '3-2', label: '3-2 行政院' },
  { id: '3-3', label: '3-3 經濟部及所屬' },
  { id: '3-4', label: '3-4 國科會與科管局' },
  { id: '3-5', label: '3-5 國發會' },
  { id: '3-6', label: '3-6 環境部及所屬' },
];

const GOV_AGENCIES = [
  {
    id: '3-1',
    groupId: '3-1',
    code: '3-1',
    name: '總統府',
    parserType: 'president',
    allowedDomains: ['president.gov.tw'],
    focusDesc: '總統對於水、能源（地熱或核電）相關發言，或出席科學園區活動等',
    defaultKeywords: ['水', '能源', '地熱', '核電', '科學園區', '竹科', '中科', '南科', '半導體'],
    strictSiteQuery: 'site:www.president.gov.tw/NEWS',
    channels: [
      { label: '新聞與活動', url: 'https://www.president.gov.tw/Page/35' },
    ],
  },
  {
    id: '3-2',
    groupId: '3-2',
    code: '3-2',
    name: '行政院',
    parserType: 'ey',
    allowedDomains: ['ey.gov.tw'],
    focusDesc: 'AI、半導體、科學園區、水、水務、能源、關稅、行政院會後記者會、院會決議',
    defaultKeywords: ['AI', '人工智慧', '半導體', '科學園區', '水', '水務', '能源', '關稅', '行政院會後記者會', '院會決議', '院會'],
    channels: [
      { label: '本院新聞', url: 'https://www.ey.gov.tw/Page/6485009ABEC1CB9C' },
      { label: '即時新聞澄清', url: 'https://www.ey.gov.tw/Page/5519E969E8931E4E', isClarification: true },
      { label: '部會新聞', url: 'https://www.ey.gov.tw/Page/B31C61707D4FEEEF' },
      { label: '行政院會議／院會決議', url: 'https://www.ey.gov.tw/Page/AE4885326ADF43DD' },
    ],
  },
  {
    id: '3-3-1',
    groupId: '3-3',
    code: '3-3-1',
    name: '經濟部（本部）',
    parserType: 'moea_hq',
    allowedDomains: ['moea.gov.tw', 'ey.gov.tw', 'gazette.nat.gov.tw'],
    focusDesc: '水、缺水、能源、地熱；訊息公告關注新增／廢除／修正法規',
    defaultKeywords: ['水', '缺水', '能源', '地熱', '修正', '廢止', '訂定', '法規', '辦法', '條例', '標準'],
    strictSiteQuery: 'site:www.moea.gov.tw/Mns/populace/news ("經濟部" OR "水" OR "能源" OR "地熱" OR "辦法" OR "公告")',
    channels: [
      { label: '本部新聞', url: 'https://www.moea.gov.tw/Mns/populace/news/News.aspx?kind=1&menu_id=40' },
      { label: '即時新聞澄清', url: 'https://www.moea.gov.tw/Mns/populace/news/News.aspx?kind=9&menu_id=22333', isClarification: true },
      { label: '訊息公告（法規異動）', url: 'https://www.moea.gov.tw/Mns/populace/news/News.aspx?kind=2&menu_id=41', checkRegulation: true },
    ],
  },
  {
    id: '3-3-2',
    groupId: '3-3',
    code: '3-3-2',
    name: '經濟部水利署',
    parserType: 'ccms',
    allowedDomains: ['wra.gov.tw'],
    focusDesc: '水利、水資源、供水、缺水、水務、科學園區／半導體用水',
    defaultKeywords: ['水利', '水資源', '供水', '缺水', '水務', '科學園區', '半導體', '水庫', '再生水', '海淡'],
    extraLinks: [
      { label: '💧 台灣水庫即時水情', url: 'https://water.taiwanstat.com/' },
    ],
    channels: [
      { label: '焦點', url: 'https://www.wra.gov.tw/News.aspx?n=6430&sms=9122' },
      { label: '新聞', url: 'https://www.wra.gov.tw/News.aspx?n=6431&sms=9122' },
      { label: '政策', url: 'https://www.wra.gov.tw/News.aspx?n=6432&sms=9122' },
    ],
  },
  {
    id: '3-3-3',
    groupId: '3-3',
    code: '3-3-3',
    name: '經濟部投資促進司',
    parserType: 'investtaiwan',
    allowedDomains: ['investtaiwan.nat.gov.tw'],
    focusDesc: 'AI、半導體、科學園區、水務',
    defaultKeywords: ['AI', '人工智慧', '半導體', '科學園區', '水務', '水資源', '投資'],
    channels: [
      { label: '最新消息', url: 'https://investtaiwan.nat.gov.tw/newsPageList?lang=cht' },
      { label: '產業情報', url: 'https://investtaiwan.nat.gov.tw/intelNewsPageList?lang=cht' },
    ],
  },
  {
    id: '3-3-4',
    groupId: '3-3',
    code: '3-3-4',
    name: '經濟部產業發展署',
    parserType: 'ida',
    allowedDomains: ['ida.gov.tw'],
    focusDesc: '新聞發布與產業大小事（可自訂關鍵字篩選，預設顯示半導體／AI／水／能源／產業動態）',
    defaultKeywords: ['產業', 'AI', '人工智慧', '半導體', '水', '能源', '淨零', '製造', '轉型', '補助'],
    channels: [
      { label: '新聞發布', url: 'https://www.ida.gov.tw/ctlr?PRO=news.NewsList' },
      { label: '產業大小事', url: 'https://www.ida.gov.tw/ctlr?PRO=news.NewsList&type=Insights' },
    ],
  },
  {
    id: '3-3-5',
    groupId: '3-3',
    code: '3-3-5',
    name: '經濟部能源署',
    parserType: 'moeaea',
    allowedDomains: ['moeaea.gov.tw'],
    focusDesc: '地熱、水利／水力、油氣、核電',
    defaultKeywords: ['地熱', '水利', '水力', '水庫', '油氣', '天然氣', '石油', '核電', '核能'],
    channels: [
      { label: '新聞', url: 'https://www.moeaea.gov.tw/ECW/populace/news/News.aspx?kind=1&menu_id=41' },
      { label: '新聞澄清', url: 'https://www.moeaea.gov.tw/ECW/populace/news/News.aspx?kind=9&menu_id=4360', isClarification: true },
      { label: '公佈欄（重要公告）', url: 'https://www.moeaea.gov.tw/ECW/populace/news/Board.aspx?kind=3&menu_id=57', checkRegulation: true },
    ],
  },
  {
    id: '3-3-6',
    groupId: '3-3',
    code: '3-3-6',
    name: '經濟部產業園區管理局',
    parserType: 'bip',
    allowedDomains: ['bip.gov.tw'],
    focusDesc: 'AI、半導體、水務',
    defaultKeywords: ['AI', '人工智慧', '半導體', '水務', '水資源', '供水', '污水', '再生水'],
    channels: [
      { label: '本局新聞', url: 'https://www.bip.gov.tw/News/5488' },
    ],
  },
  {
    id: '3-3-7',
    groupId: '3-3',
    code: '3-3-7',
    name: '台灣自來水公司（台水）',
    parserType: 'water',
    allowedDomains: ['water.gov.tw'],
    focusDesc: '水價、供水、水利、水資源、缺水',
    defaultKeywords: ['水價', '供水', '水利', '水資源', '缺水', '停水', '減壓', '水質', '送水'],
    channels: [
      { label: '訊息公佈欄', url: 'https://www.water.gov.tw/ch/Subject?nodeId=711' },
      { label: '區域 hot 新聞', url: 'https://www.water.gov.tw/ch/Subject?nodeId=712' },
    ],
  },
  {
    id: '3-3-8',
    groupId: '3-3',
    code: '3-3-8',
    name: '台灣中油（中油）',
    parserType: 'ccms',
    allowedDomains: ['cpc.com.tw'],
    focusDesc: '地熱、油氣',
    defaultKeywords: ['地熱', '油氣', '天然氣', '油價', '汽、柴油', '探勘', '液化天然氣'],
    channels: [
      { label: '新聞稿', url: 'https://www.cpc.com.tw/News2.aspx?n=28&sms=8920' },
      { label: '最新訊息', url: 'https://www.cpc.com.tw/News.aspx?n=30&sms=8967' },
    ],
  },
  {
    id: '3-3-9',
    groupId: '3-3',
    code: '3-3-9',
    name: '經濟部標準檢驗局',
    parserType: 'bsmi',
    allowedDomains: ['bsmi.gov.tw'],
    focusDesc: '化工商品',
    defaultKeywords: ['化工', '化學', '商品', '檢驗', '標準', '塑膠', '塗料'],
    channels: [
      { label: '本局新聞', url: 'https://www.bsmi.gov.tw/wSite/lp?ctNode=8321&CtUnit=963&BaseDSD=7' },
    ],
  },
  {
    id: '3-3-10',
    groupId: '3-3',
    code: '3-3-10',
    name: '地熱發電單一服務窗口',
    parserType: 'geothermal',
    allowedDomains: ['ea01.moeaea.gov.tw', 'moeaea.gov.tw'],
    focusDesc: '地熱',
    defaultKeywords: ['地熱', '發電', '探勘', '案場', '法規', '永續'],
    channels: [
      { label: '近期活動', url: 'https://ea01.moeaea.gov.tw/b0403/News/Index/A013' },
      { label: '政策法規', url: 'https://ea01.moeaea.gov.tw/b0403/News/Index/A012', checkRegulation: true },
      { label: '新聞推動', url: 'https://ea01.moeaea.gov.tw/b0403/News/Index/A011' },
    ],
  },
  {
    id: '3-4-1',
    groupId: '3-4',
    code: '3-4-1',
    name: '國科會（本部）',
    parserType: 'nstc',
    allowedDomains: ['nstc.gov.tw'],
    focusDesc: '水資源、營收、核准投資案（關注水務相關廠商）、AI／半導體',
    defaultKeywords: ['水資源', '水務', '再生水', '營收', '營業額', '核准投資', '投資案', '園區審議', 'AI', '人工智慧', '半導體'],
    channels: [
      { label: '一般公告', url: 'https://www.nstc.gov.tw/folksonomy/list/d3c30297-bb63-44c5-ad30-38a65b203288?l=ch' },
      { label: '新聞資料', url: 'https://www.nstc.gov.tw/folksonomy/list/9aa56881-8df0-4eb6-a5a7-32a2f72826ff?l=ch' },
    ],
  },
  {
    id: '3-4-2',
    groupId: '3-4',
    code: '3-4-2',
    name: '新竹科學園區管理局（竹科）',
    parserType: 'sipa',
    allowedDomains: ['sipa.gov.tw'],
    focusDesc: '水資源、營收、核准投資案（關注水務相關廠商）',
    defaultKeywords: ['水資源', '水務', '再生水', '營收', '營業額', '核准投資', '投資案', '入區', '用水'],
    channels: [
      {
        label: '最新消息',
        url: 'https://www.sipa.gov.tw/home.jsp?serno=201001210002&mserno=201001210001&menudata=ChineseMenu&contlink=ap/information_1.jsp&level2=Y',
      },
    ],
  },
  {
    id: '3-4-3',
    groupId: '3-4',
    code: '3-4-3',
    name: '中部科學園區管理局（中科）',
    parserType: 'ctsp',
    allowedDomains: ['ctsp.gov.tw'],
    focusDesc: '水資源、營收、核准投資案（關注水務相關廠商）',
    defaultKeywords: ['水資源', '水務', '再生水', '營收', '營業額', '核准投資', '投資案', '入區', '用水'],
    channels: [
      { label: '最新公告', url: 'https://www.ctsp.gov.tw/chinese/01-News/01-online.aspx?v=1&fr=1000&no=1001' },
      { label: '即時新聞澄清', url: 'https://www.ctsp.gov.tw/chinese/01-News/03-custom.aspx?v=1&fr=1000&no=1003', isClarification: true },
    ],
  },
  {
    id: '3-4-4',
    groupId: '3-4',
    code: '3-4-4',
    name: '南部科學園區管理局（南科）',
    parserType: 'stsp',
    allowedDomains: ['stsp.gov.tw'],
    focusDesc: '水資源、營收、核准投資案（關注水務相關廠商）、沙崙園區',
    defaultKeywords: ['水資源', '水務', '水境', '再生水', '營收', '營業額', '核准投資', '投資案', '沙崙'],
    channels: [
      { label: '最新消息及活動', url: 'https://www.stsp.gov.tw/guide/public_info/report/rt_list.jsp' },
      { label: '新聞資料專區', url: 'https://www.stsp.gov.tw/guide/public_info/press/ps_list.jsp' },
    ],
  },
  {
    id: '3-5',
    groupId: '3-5',
    code: '3-5',
    name: '國家發展委員會（國發會）',
    parserType: 'ndc_rss',
    allowedDomains: ['ndc.gov.tw'],
    focusDesc: '接受商會建言、科學園區發展、缺水、半導體／AI發展、國家發展計畫（半導體／AI、能源）、委員會議新聞稿',
    defaultKeywords: ['商會', '建言', '科學園區', '缺水', '水資源', '半導體', 'AI', '人工智慧', '國家發展計畫', '能源', '委員會議'],
    channels: [
      {
        label: '本會動態',
        url: 'https://www.ndc.gov.tw/News12_1.aspx?n=3E6699ADB0BE3855&sms=C7BF44606A5BF73F',
        rssUrl: 'https://www.ndc.gov.tw/Rss_News.aspx?n=3E6699ADB0BE3855',
      },
      {
        label: '新聞稿',
        url: 'https://www.ndc.gov.tw/News9.aspx?n=114AAE178CD95D4C&sms=DF717169EA26F1A3',
        rssUrl: 'https://www.ndc.gov.tw/Rss_News.aspx?n=114AAE178CD95D4C',
      },
      {
        label: '最新消息',
        url: 'https://www.ndc.gov.tw/News_TopNews.aspx?n=1CE324F4C0BA40AC',
        rssUrl: 'https://www.ndc.gov.tw/Rss_News.aspx?n=1CE324F4C0BA40AC',
      },
    ],
  },
  {
    id: '3-6',
    groupId: '3-6',
    code: '3-6',
    name: '環境部（本部／氣候變遷署）',
    parserType: 'moenv',
    allowedDomains: ['cca.gov.tw', 'moenv.gov.tw'],
    focusDesc: '循環經濟、南科沙崙園區（環評）',
    defaultKeywords: ['循環經濟', '沙崙', '南科', '環評', '環境影響評估', '水質', '淨水', '減碳'],
    channels: [
      { label: '新聞發布', url: 'https://www.cca.gov.tw/news-and-releases/press-releases/1544.html' },
      { label: '即時新聞澄清', url: 'https://enews.moenv.gov.tw/News/List?key=12&Lang=zh-tw', isClarification: true },
    ],
  },
  {
    id: '3-6-1',
    groupId: '3-6',
    code: '3-6-1',
    name: '環境部資源循環署',
    parserType: 'reca',
    allowedDomains: ['reca.gov.tw', 'moenv.gov.tw'],
    focusDesc: '資源循環',
    defaultKeywords: ['資源循環', '循環經濟', '回收', '再利用', '廢棄物', '再生'],
    strictSiteQuery: 'site:enews.moenv.gov.tw "資源循環"',
    channels: [
      { label: '新聞發布', url: 'https://www.reca.gov.tw/more/news' },
      { label: '即時新聞澄清', url: 'https://www.reca.gov.tw/InstantNews', isClarification: true },
    ],
  },
  {
    id: '3-6-2',
    groupId: '3-6',
    code: '3-6-2',
    name: '環境部化學物質管理署',
    parserType: 'cha_rss',
    allowedDomains: ['cha.gov.tw', 'moenv.gov.tw'],
    focusDesc: '水資源、半導體、鼠害',
    defaultKeywords: ['水資源', '水質', '飲用水', '全氟', 'PFAS', '半導體', '鼠害', '滅鼠', '殺鼠劑', '化學'],
    channels: [
      {
        label: '新聞發布',
        url: 'https://www.cha.gov.tw/lp-23-1.html',
        rssUrl: 'https://www.cha.gov.tw/rss-23-1.html',
      },
    ],
  },
];

function decodeEntities(str = '') {
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

function stripTags(str = '') {
  return decodeEntities(str)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseGovDate(text = '') {
  if (!text) return null;
  const s = String(text).trim();

  // ISO YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  const iso = s.match(/(202[0-9])[\/.\-年]\s*(\d{1,2})[\/.\-月]\s*(\d{1,2})/);
  if (iso) {
    const dt = new Date(`${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}T08:00:00+08:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // ROC Minguo 110~119
  const roc = s.match(/(?:^|\D)(11[0-9])[\/.\-年]\s*(\d{1,2})[\/.\-月]\s*(\d{1,2})/);
  if (roc) {
    const y = parseInt(roc[1], 10) + 1911;
    const dt = new Date(`${y}-${roc[2].padStart(2, '0')}-${roc[3].padStart(2, '0')}T08:00:00+08:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isOfficialAllowedHost(urlOrHost = '', allowedDomains = []) {
  try {
    const host = urlOrHost.includes('://') ? new URL(urlOrHost).hostname.toLowerCase() : urlOrHost.toLowerCase();
    return allowedDomains.some((dom) => host === dom || host.endsWith(`.${dom}`));
  } catch (_) {
    return false;
  }
}

function getHostnameLabel(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

function detectSpecialBadge(title = '', channel = {}, agency = {}) {
  if (channel.isClarification || /澄清|闢謠/.test(title)) {
    return { type: 'clarify', label: '新聞澄清' };
  }
  if (
    channel.checkRegulation ||
    /(修正|訂定|廢止|預告|發布令|辦法|條例|標準|要點|基準)/.test(title)
  ) {
    return { type: 'regulation', label: '法規／公告' };
  }
  if (
    agency.groupId === '3-4' &&
    /(核准投資|投資案|審議會|入區|營業額|營收|水務|再生水)/.test(title)
  ) {
    return { type: 'park', label: '園區投資／營運' };
  }
  return null;
}

function evaluateKeywordHit(itemText, keywords = []) {
  const lower = itemText.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

function makeItem(agency, channel, { title, link, summary = '', dateObj = null }) {
  const cleanTitle = stripTags(title)
    .replace(/[\[（(]\s*另開新視窗\s*[\]）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanTitle || cleanTitle.length < 7) return null;
  if (/^(?:即時新聞澄清|本部新聞|訊息公告|最新消息|新聞發布|本局新聞)$/.test(cleanTitle)) return null;

  const matchedKeywords = evaluateKeywordHit(`${cleanTitle} ${summary}`, agency.defaultKeywords);
  const officialHost = getHostnameLabel(link || channel.url);

  return {
    agencyId: agency.id,
    groupId: agency.groupId,
    code: agency.code,
    agencyName: agency.name,
    channelLabel: channel.label,
    channelUrl: channel.url,
    officialHost,
    title: cleanTitle,
    link: link || channel.url,
    summary: stripTags(summary).slice(0, 220),
    publishedAt: dateObj ? dateObj.toISOString() : null,
    timestamp: dateObj ? dateObj.getTime() : 0,
    matchedKeywords,
    isDefaultMatch: matchedKeywords.length > 0,
    specialBadge: detectSpecialBadge(cleanTitle, channel, agency),
  };
}

async function safeFetchText(url, timeoutMs = 16000) {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function extractXmlTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decodeEntities(m[1].trim()) : '';
}

function extractXmlAttr(block, tag, attr) {
  const m = block.match(new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, 'i'));
  return m ? decodeEntities(m[1].trim()) : '';
}

/**
 * Parse official RSS XML directly hosted on a .gov.tw site (e.g., ndc.gov.tw, cha.gov.tw)
 */
async function parseOfficialGovRss(agency, channel, rssUrl) {
  const xml = await safeFetchText(rssUrl, 14000);
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  const out = [];
  for (const b of blocks.slice(0, 35)) {
    const title = extractXmlTag(b, 'title');
    const link = extractXmlTag(b, 'link');
    const desc = extractXmlTag(b, 'description');
    const pubDate = extractXmlTag(b, 'pubDate') || extractXmlTag(b, 'dc:date');
    if (!isOfficialAllowedHost(link || channel.url, agency.allowedDomains)) continue;
    const item = makeItem(agency, channel, {
      title,
      link,
      summary: desc,
      dateObj: parseGovDate(pubDate) || parseGovDate(desc),
    });
    if (item) out.push(item);
  }
  return out;
}

/**
 * Strict Official Site Search Supplement:
 * ONLY accepts items whose <source url="..."> is strictly on agency.allowedDomains (.gov.tw)!
 * Rejects 100% of external media outlets.
 */
async function fetchStrictOfficialSiteIndex(agency) {
  if (!agency.strictSiteQuery) return [];
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    agency.strictSiteQuery
  )}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
  let xml;
  try {
    xml = await safeFetchText(rssUrl, 10000);
  } catch (_) {
    return [];
  }
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  const out = [];
  const ch = agency.channels[0];

  for (const b of blocks) {
    const sourceUrl = extractXmlAttr(b, 'source', 'url');
    // STRICT CHECK: <source url> MUST be the official government domain (e.g. www.moea.gov.tw)!
    if (!sourceUrl || !isOfficialAllowedHost(sourceUrl, agency.allowedDomains)) {
      continue;
    }
    let rawTitle = extractXmlTag(b, 'title');
    const dashIdx = rawTitle.lastIndexOf(' - ');
    if (dashIdx > 4) rawTitle = rawTitle.slice(0, dashIdx).trim();

    const pubDate = extractXmlTag(b, 'pubDate');
    const desc = stripTags(extractXmlTag(b, 'description'));
    const summary = desc.startsWith(rawTitle) ? '' : desc;

    const item = makeItem(agency, ch, {
      title: rawTitle,
      link: ch.url, // Direct official portal or resolved link; host label uses sourceUrl
      summary,
      dateObj: parseGovDate(pubDate),
    });
    if (item) {
      // Keep Google's redirect link so clicking opens the exact official .gov.tw article, while displaying sourceUrl host!
      const gLink = extractXmlTag(b, 'link');
      if (gLink) item.link = gLink;
      item.officialHost = getHostnameLabel(sourceUrl);
      out.push(item);
    }
  }
  return out;
}

/**
 * Agency-specific official DOM parsers (100% official list items, 0% nav/sidebar links)
 */
async function parseChannelHtmlByType(agency, channel) {
  // 1) Official RSS agencies (3-5 NDC, 3-6-2 CHA)
  if (channel.rssUrl) {
    try {
      const rssItems = await parseOfficialGovRss(agency, channel, channel.rssUrl);
      if (rssItems.length > 0) return rssItems;
    } catch (_) {}
  }

  // 2) 3-3-1 MOEA HQ: Pull official <span>經濟部</span> press releases directly from Executive Yuan 部會新聞 (ey.gov.tw)
  if (agency.parserType === 'moea_hq') {
    if (channel.label !== '本部新聞') return [];
    const out = [];
    for (const page of [1, 2, 3, 4]) {
      try {
        const html = await safeFetchText(`https://www.ey.gov.tw/Page/B31C61707D4FEEEF?page=${page}&ps=30`, 12000);
        const boxRe = /<div class="news_box[^"]*">([\s\S]*?)<\/div>\s*<\/li>/gi;
        let m;
        while ((m = boxRe.exec(html)) !== null) {
          const block = m[1];
          if (!/<span>\s*經濟部\s*<\/span>/.test(block)) continue;
          const href = block.match(/href=["']([^"']+)["']/i)?.[1];
          const titleRaw = block.match(/<div class="title">([\s\S]*?)<\/div>/i)?.[1] || '';
          const title = titleRaw.replace(/<span>[\s\S]*?<\/span>/gi, '').trim();
          const dateStr = block.match(/<span class="date">([\s\S]*?)<\/span>/i)?.[1] || '';
          const desc = block.match(/<p>([\s\S]*?)<\/p>/i)?.[1] || '';
          if (!href || !title) continue;
          const fullUrl = new URL(decodeEntities(href), 'https://www.ey.gov.tw').href;
          const item = makeItem(agency, { label: '經濟部新聞（行政院部會新聞發布）', url: channel.url }, {
            title,
            link: fullUrl,
            summary: desc,
            dateObj: parseGovDate(dateStr),
          });
          if (item) out.push(item);
        }
      } catch (_) {}
    }
    return out;
  }

  // 3) 3-6-1 RECA (資源循環署): Official releases hosted on 環境部新聞專區 enews.moenv.gov.tw
  if (agency.parserType === 'reca') {
    const targetUrl = channel.isClarification
      ? 'https://enews.moenv.gov.tw/News/List?key=12&Lang=zh-tw'
      : 'https://enews.moenv.gov.tw/News/List?key=11&Lang=zh-tw';
    try {
      const html = await safeFetchText(targetUrl, 14000);
      const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      const out = [];
      let m;
      while ((m = liRe.exec(html)) !== null) {
        const block = m[1];
        if (!/\/moenv-news\/zh-tw\/News\/\d+/i.test(block)) continue;
        // C71 / CA0 or text mentioning 資源循環 / 回收 / 廢棄物
        if (!/C71\.jpg|CA0\.jpg|資源循環|回收|廢棄物|再利用/i.test(block)) continue;
        const href = block.match(/href=["']([^"']*\/News\/\d+[^"']*)["']/i)?.[1];
        const srTitle = block.match(/<span class="sr-only">([\s\S]*?)<\/span>/i)?.[1];
        const hTitle = block.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i)?.[1] || srTitle || stripTags(block);
        const dt = parseGovDate(block);
        if (!href || !hTitle) continue;
        const fullUrl = new URL(decodeEntities(href), 'https://enews.moenv.gov.tw').href;
        const item = makeItem(agency, channel, { title: hTitle, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      return out;
    } catch (_) {
      return [];
    }
  }

  // Fetch the channel HTML for all other direct official pages
  let html;
  try {
    html = await safeFetchText(channel.url, 18000);
  } catch (_) {
    return [];
  }
  if (!html) return [];

  const out = [];

  switch (agency.parserType) {
    case 'president': {
      // 3-1 總統府: <li ...> containing href="/NEWS/\d+" + date + title
      const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let m;
      while ((m = liRe.exec(html)) !== null) {
        const block = m[1];
        const hrefMatch = block.match(/href=["']([^"']*\/NEWS\/\d+[^"']*)["']/i);
        if (!hrefMatch) continue;
        const fullUrl = new URL(decodeEntities(hrefMatch[1]), channel.url).href;
        const dt = parseGovDate(block);
        // Remove "詳細內容" and date string to isolate headline
        let text = stripTags(block)
          .replace(/詳細內容/g, '')
          .replace(/\b(?:202\d|11\d)[\/.\-]\d{1,2}[\/.\-]\d{1,2}\b/g, '')
          .replace(/^新聞與活動\s*/, '')
          .trim();
        const item = makeItem(agency, channel, { title: text, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'ey': {
      // 3-2 行政院: <div class="news_box">
      const boxRe = /<div class="news_box[^"]*">([\s\S]*?)<\/div>\s*<\/li>/gi;
      let m;
      while ((m = boxRe.exec(html)) !== null) {
        const block = m[1];
        const href = block.match(/href=["']([^"']+)["']/i)?.[1];
        const titleRaw = block.match(/<div class="title">([\s\S]*?)<\/div>/i)?.[1] || '';
        const unitSpan = titleRaw.match(/<span>([\s\S]*?)<\/span>/i)?.[1]?.trim() || '';
        const title = titleRaw.replace(/<span>[\s\S]*?<\/span>/gi, '').trim();
        const dateStr = block.match(/<span class="date">([\s\S]*?)<\/span>/i)?.[1] || '';
        const desc = block.match(/<p>([\s\S]*?)<\/p>/i)?.[1] || '';
        if (!href || !title) continue;
        const fullUrl = new URL(decodeEntities(href), channel.url).href;
        const item = makeItem(agency, channel, {
          title: unitSpan ? `【${unitSpan}】${title}` : title,
          link: fullUrl,
          summary: desc,
          dateObj: parseGovDate(dateStr),
        });
        if (item) out.push(item);
      }
      break;
    }

    case 'ccms': {
      // 3-3-2 水利署 & 3-3-8 中油: News_Content.aspx links
      const aRe = /<a\b([^>]*href=["'][^"']*News_Content\.aspx[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = aRe.exec(html)) !== null) {
        const attrs = m[1];
        const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
        const titleAttr = attrs.match(/title=["']([^"']+)["']/i)?.[1];
        const text = stripTags(m[2]) || stripTags(titleAttr || '');
        if (!href || !text || text.length < 6) continue;
        const ctx = stripTags(html.slice(Math.max(0, m.index - 220), Math.min(html.length, m.index + m[0].length + 320)));
        const dt = parseGovDate(ctx);
        const fullUrl = new URL(decodeEntities(href), channel.url).href;
        const item = makeItem(agency, channel, { title: text, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'investtaiwan': {
      // 3-3-3 投資促進司: <a class="... j_search_list ..." href="./newsPage...">
      const aRe = /<a\b[^>]*class=["'][^"']*j_search_list[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = aRe.exec(html)) !== null && out.length < 35) {
        const fullUrl = new URL(decodeEntities(m[1]), channel.url).href;
        const rawText = stripTags(m[2]);
        const dt = parseGovDate(rawText);
        const title = rawText.replace(/^\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}\s*/, '').trim();
        const item = makeItem(agency, channel, { title, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'ida': {
      // 3-3-4 產業發展署: <a href="/ctlr?PRO=news.NewsView&id=...">
      const aRe = /<a\b([^>]*href=["'][^"']*PRO=news\.NewsView[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = aRe.exec(html)) !== null) {
        const attrs = m[1];
        const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
        const summaryAttr = attrs.match(/title=["']([^"']+)["']/i)?.[1] || '';
        const title = stripTags(m[2]);
        const prevSlice = stripTags(html.slice(Math.max(0, m.index - 250), m.index));
        const dt = parseGovDate(prevSlice);
        const fullUrl = new URL(decodeEntities(href), channel.url).href;
        const item = makeItem(agency, channel, { title, link: fullUrl, summary: summaryAttr, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'moeaea': {
      // 3-3-5 能源署: <div class="DataTable_Text"> or tr containing news_id= / p_id=
      const aRe = /<a\b([^>]*href=["'][^"']*(?:news_id=|p_id=|Board\.aspx\?[^"']*id=)[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = aRe.exec(html)) !== null) {
        const href = m[1].match(/href=["']([^"']+)["']/i)?.[1];
        const title = stripTags(m[2]);
        const nextSlice = stripTags(html.slice(m.index, Math.min(html.length, m.index + m[0].length + 180)));
        const dt = parseGovDate(nextSlice);
        const fullUrl = new URL(decodeEntities(href), channel.url).href;
        const item = makeItem(agency, channel, { title, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'bip': {
      // 3-3-6 產業園區管理局: Embedded official JSON `let DefaultData = [...]`
      const jsonMatch = html.match(/let\s+DefaultData\s*=\s*(\[[\s\S]*?\]);/);
      if (jsonMatch) {
        try {
          const arr = JSON.parse(jsonMatch[1]);
          for (const row of arr.slice(0, 35)) {
            const title = row['主題'] || row.Title || '';
            const dateStr = row['上版日期'] || row.Date || '';
            const relPath = row.Path || `/News_Content/5488/${row.S_N || ''}`;
            const fullUrl = new URL(relPath, 'https://www.bip.gov.tw').href;
            const item = makeItem(agency, channel, {
              title,
              link: fullUrl,
              dateObj: parseGovDate(dateStr),
            });
            if (item) out.push(item);
          }
        } catch (_) {}
      }
      break;
    }

    case 'water': {
      // 3-3-7 台水: <div class="bulletin_list_item"> <a href="/ch/Subject/Detail/...">
      const aRe = /<a\b([^>]*href=["'][^"']*\/Subject\/Detail\/[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = aRe.exec(html)) !== null) {
        const attrs = m[1];
        const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
        const title = attrs.match(/title=["']([^"']+)["']/i)?.[1] || stripTags(m[2]);
        const inner = stripTags(m[2]);
        const dt = parseGovDate(inner);
        const fullUrl = new URL(decodeEntities(href), channel.url).href;
        const item = makeItem(agency, channel, { title, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'bsmi': {
      // 3-3-9 標準檢驗局: <a href="ct?xItem=...">
      const aRe = /<a\b([^>]*href=["'][^"']*ct\?xItem=[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = aRe.exec(html)) !== null) {
        const attrs = m[1];
        const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
        const title = attrs.match(/title=["']([^"']+)["']/i)?.[1] || stripTags(m[2]);
        const dt = parseGovDate(m[2]);
        const fullUrl = new URL(decodeEntities(href), channel.url).href;
        const item = makeItem(agency, channel, { title, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'geothermal': {
      // 3-3-10 地熱發電單一服務窗口: <a href="/b0403/News/Show?id=...">
      const aRe = /<a\b[^>]*href=["']([^"']*\/b0403\/News\/Show\?id=[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = aRe.exec(html)) !== null) {
        const fullUrl = new URL(decodeEntities(m[1]), channel.url).href;
        const titMatch = m[2].match(/<p[^>]*class=["'][^"']*tit[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
        const title = titMatch ? stripTags(titMatch[1]) : stripTags(m[2]);
        const dt = parseGovDate(m[2]);
        const item = makeItem(agency, channel, { title, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'nstc': {
      // 3-4-1 國科會: <a href="/folksonomy/detail/...">
      const aRe = /<a\b[^>]*href=["']([^"']*\/folksonomy\/detail\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = aRe.exec(html)) !== null) {
        const fullUrl = new URL(decodeEntities(m[1]), channel.url).href;
        const h3Match = m[2].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
        const title = h3Match ? stripTags(h3Match[1]) : stripTags(m[2]);
        const dt = parseGovDate(m[2]);
        const item = makeItem(agency, channel, { title, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'sipa': {
      // 3-4-2 竹科: <a href="...dataserno=..." title="...">
      const aRe = /<a\b([^>]*href=["'][^"']*dataserno=[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = aRe.exec(html)) !== null) {
        const attrs = m[1];
        const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
        const title = stripTags(m[2]) || attrs.match(/title=["']([^"']+)["']/i)?.[1] || '';
        const nextSlice = stripTags(html.slice(m.index, Math.min(html.length, m.index + m[0].length + 220)));
        const dt = parseGovDate(nextSlice);
        const fullUrl = new URL(decodeEntities(href), channel.url).href;
        const item = makeItem(agency, channel, { title, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'ctsp': {
      // 3-4-3 中科: <tr class="line_1"> ... <a href="..._view.aspx..." class="title">
      const trRe = /<tr\b[^>]*class=["'][^"']*line_\d+[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
      let m;
      while ((m = trRe.exec(html)) !== null) {
        const row = m[1];
        const aMatch = row.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (!aMatch) continue;
        const fullUrl = new URL(decodeEntities(aMatch[1]), channel.url).href;
        const title = stripTags(aMatch[2]);
        const dt = parseGovDate(row);
        const item = makeItem(agency, channel, { title, link: fullUrl, dateObj: dt });
        if (item) out.push(item);
      }
      break;
    }

    case 'stsp': {
      // 3-4-4 南科: <div class="kf_div_tr kf_list"> with goDetails('c','r','p')
      const detailPage = channel.url.includes('ps_list.jsp') ? 'ps_detail.jsp' : 'rt_detail.jsp';
      const rowRe = /<div class="kf_div_tr kf_list"[^>]*>([\s\S]*?)<div class="kf_div_td[^>]*end_date[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi;
      let m;
      while ((m = rowRe.exec(html)) !== null) {
        const block = m[1];
        const goMatch = block.match(/goDetails\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/i);
        const aMatch = block.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
        const relDate = block.match(/release_date[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
        if (!aMatch) continue;
        const title = stripTags(aMatch[1]);
        const detailHref = goMatch
          ? `${detailPage}?sc=${encodeURIComponent(goMatch[1])}&rep_rfnbr=${encodeURIComponent(
              goMatch[2]
            )}&hidpage=${encodeURIComponent(goMatch[3])}`
          : channel.url;
        const fullUrl = new URL(detailHref, channel.url).href;
        const item = makeItem(agency, channel, { title, link: fullUrl, dateObj: parseGovDate(relDate) });
        if (item) out.push(item);
      }
      break;
    }

    case 'moenv': {
      // 3-6 環境部 CCA (li.listI) & enews.moenv.gov.tw (/moenv-news/zh-tw/News/\d+)
      if (channel.url.includes('cca.gov.tw')) {
        const liRe = /<li[^>]*class=["'][^"']*listI[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
        let m;
        while ((m = liRe.exec(html)) !== null) {
          const href = m[1].match(/href=["']([^"']+)["']/i)?.[1];
          const strong = m[1].match(/<strong>([\s\S]*?)<\/strong>/i)?.[1] || stripTags(m[1]);
          const dt = parseGovDate(m[1]);
          if (!href) continue;
          const fullUrl = new URL(decodeEntities(href), channel.url).href;
          if (!isOfficialAllowedHost(fullUrl, agency.allowedDomains)) continue;
          const item = makeItem(agency, channel, { title: strong, link: fullUrl, dateObj: dt });
          if (item) out.push(item);
        }
      } else {
        const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
        let m;
        while ((m = liRe.exec(html)) !== null) {
          const block = m[1];
          const href = block.match(/href=["']([^"']*\/moenv-news\/zh-tw\/News\/\d+[^"']*)["']/i)?.[1];
          if (!href) continue;
          const sr = block.match(/<span class="sr-only">([\s\S]*?)<\/span>/i)?.[1];
          const title = sr || stripTags(block);
          const dt = parseGovDate(block);
          const fullUrl = new URL(decodeEntities(href), 'https://enews.moenv.gov.tw').href;
          const item = makeItem(agency, channel, { title, link: fullUrl, dateObj: dt });
          if (item) out.push(item);
        }
      }
      break;
    }

    default:
      break;
  }

  // Final safety filter: ensure every item's link or officialHost belongs to agency.allowedDomains
  return out.filter(
    (it) =>
      isOfficialAllowedHost(it.link, agency.allowedDomains) ||
      isOfficialAllowedHost(it.officialHost, agency.allowedDomains)
  );
}

function deduplicateGovItems(items) {
  const seen = new Map();
  const out = [];
  for (const it of items) {
    const norm = `${it.agencyId}:${(it.title || '')
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, '')
      .slice(0, 40)}`;
    if (!norm || norm.endsWith(':')) continue;
    if (seen.has(norm)) {
      const existing = seen.get(norm);
      if (!existing.publishedAt && it.publishedAt) {
        existing.publishedAt = it.publishedAt;
        existing.timestamp = it.timestamp;
      }
      continue;
    }
    const copy = { ...it };
    seen.set(norm, copy);
    out.push(copy);
  }
  return out;
}

async function fetchSingleAgency(agency) {
  const [channelArrays, strictSiteItems] = await Promise.all([
    Promise.all(agency.channels.map((ch) => parseChannelHtmlByType(agency, ch))),
    fetchStrictOfficialSiteIndex(agency),
  ]);

  const combined = [...channelArrays.flat(), ...strictSiteItems];
  const deduped = deduplicateGovItems(combined).sort((a, b) => {
    if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp;
    if (a.timestamp && !b.timestamp) return -1;
    if (!a.timestamp && b.timestamp) return 1;
    return 0;
  });

  // Return up to 45 official announcements per agency so client-side editable keywords can match against the full official feed!
  return deduped.slice(0, 45);
}

async function fetchGovernmentUpdates() {
  const allItems = [];
  const batchSize = 5;

  for (let i = 0; i < GOV_AGENCIES.length; i += batchSize) {
    const batch = GOV_AGENCIES.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((ag) => fetchSingleAgency(ag)));
    results.forEach((items) => allItems.push(...items));
  }

  allItems.sort((a, b) => {
    if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp;
    if (a.timestamp && !b.timestamp) return -1;
    if (!a.timestamp && b.timestamp) return 1;
    return 0;
  });

  const agencyMeta = GOV_AGENCIES.map((ag) => {
    const agItems = allItems.filter((it) => it.agencyId === ag.id);
    const matchedCount = agItems.filter((it) => it.isDefaultMatch).length;
    return {
      id: ag.id,
      groupId: ag.groupId,
      code: ag.code,
      name: ag.name,
      focusDesc: ag.focusDesc,
      defaultKeywords: ag.defaultKeywords,
      channels: ag.channels.map(({ label, url }) => ({ label, url })),
      extraLinks: ag.extraLinks || [],
      matchedCount,
      totalCount: agItems.length,
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
    officialOnly: true,
    groups: GOV_GROUPS,
    agencies: agencyMeta,
    reservoirLink: {
      label: '台灣水庫即時水情',
      url: 'https://water.taiwanstat.com/',
    },
    totalMatched: allItems.filter((i) => i.isDefaultMatch).length,
    totalAll: allItems.length,
    items: allItems,
  };
}

module.exports = {
  GOV_GROUPS,
  GOV_AGENCIES,
  fetchGovernmentUpdates,
};
