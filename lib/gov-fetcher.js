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
    focusDesc: '總統對於水、能源（地熱或核電）相關發言，或出席科學園區活動等',
    defaultKeywords: ['水', '水資源', '治水', '供水', '能源', '地熱', '核電', '核能', '綠能', '科學園區', '竹科', '中科', '南科', '沙崙', '半導體'],
    searchQuery: 'site:president.gov.tw ("水" OR "能源" OR "地熱" OR "核電" OR "科學園區" OR "半導體")',
    fallbackQuery: '"總統府" ("水資源" OR "地熱" OR "核電" OR "科學園區")',
    channels: [
      { label: '新聞與活動', url: 'https://www.president.gov.tw/Page/35' },
    ],
  },
  {
    id: '3-2',
    groupId: '3-2',
    code: '3-2',
    name: '行政院',
    focusDesc: 'AI、半導體、科學園區、水、水務、能源、關稅、行政院會後記者會、院會決議',
    defaultKeywords: ['AI', '人工智慧', '半導體', '科學園區', '水', '水務', '水資源', '能源', '關稅', '行政院會後記者會', '院會決議', '院會'],
    searchQuery: 'site:ey.gov.tw ("AI" OR "半導體" OR "科學園區" OR "水資源" OR "水務" OR "能源" OR "關稅" OR "院會")',
    fallbackQuery: '"行政院" ("行政院會後記者會" OR "院會決議" OR "水資源" OR "科學園區" OR "關稅")',
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
    focusDesc: '水、缺水、能源、地熱；訊息公告關注新增／廢止／修正法規',
    defaultKeywords: ['水', '缺水', '供水', '能源', '地熱', '修正', '廢止', '訂定', '法規', '辦法', '標準', '條例', '預告'],
    searchQuery: 'site:moea.gov.tw ("水" OR "缺水" OR "能源" OR "地熱" OR "修正" OR "廢止" OR "訂定" OR "辦法")',
    fallbackQuery: '"經濟部" ("水資源" OR "缺水" OR "能源" OR "地熱" OR "修正草案" OR "廢止")',
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
    focusDesc: '水利、水資源、供水、缺水、水務、科學園區／半導體用水',
    defaultKeywords: ['水利', '水資源', '供水', '缺水', '水務', '水情', '水庫', '海淡', '再生水', '伏流水', '科學園區', '半導體'],
    searchQuery: 'site:wra.gov.tw ("水利" OR "水資源" OR "供水" OR "缺水" OR "水務" OR "科學園區" OR "水庫")',
    fallbackQuery: '"水利署" ("水利" OR "水資源" OR "供水" OR "缺水" OR "水務" OR "科學園區" OR "半導體")',
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
    focusDesc: 'AI、半導體、科學園區、水務',
    defaultKeywords: ['AI', '人工智慧', '半導體', '科學園區', '水務', '水資源', '再生水', '投資臺灣', '投資台灣'],
    searchQuery: 'site:investtaiwan.nat.gov.tw ("AI" OR "半導體" OR "科學園區" OR "水務" OR "水資源")',
    fallbackQuery: '("投資促進司" OR "投資臺灣事務所") ("AI" OR "半導體" OR "科學園區" OR "水務" OR "水資源")',
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
    focusDesc: '新聞發布與產業大小事（AI、半導體、水務、淨零與產業動態）',
    defaultKeywords: ['AI', '人工智慧', '半導體', '水', '能源', '淨零', '低碳', '產業', '製造', '園區', '轉型', '補助'],
    matchAllByDefault: true,
    searchQuery: 'site:ida.gov.tw',
    fallbackQuery: '"產業發展署" ("產業" OR "AI" OR "半導體" OR "水" OR "淨零")',
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
    focusDesc: '地熱、水利／水力、油氣、核電',
    defaultKeywords: ['地熱', '水利', '水力', '水庫', '油氣', '天然氣', '石油', '核電', '核能', '光電', '綠電'],
    searchQuery: 'site:moeaea.gov.tw ("地熱" OR "水利" OR "水力" OR "油氣" OR "核電")',
    fallbackQuery: '"能源署" ("地熱" OR "水力" OR "水利" OR "油氣" OR "核電")',
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
    focusDesc: 'AI、半導體、水務',
    defaultKeywords: ['AI', '人工智慧', '半導體', '水務', '水資源', '供水', '污水', '再生水', '園區'],
    searchQuery: 'site:bip.gov.tw ("AI" OR "半導體" OR "水務" OR "水資源" OR "園區")',
    fallbackQuery: '"產業園區管理局" ("AI" OR "半導體" OR "水務" OR "水資源" OR "供水")',
    channels: [
      { label: '本局新聞', url: 'https://www.bip.gov.tw/News/5488' },
    ],
  },
  {
    id: '3-3-7',
    groupId: '3-3',
    code: '3-3-7',
    name: '台灣自來水公司（台水）',
    focusDesc: '水價、供水、水利、水資源、缺水',
    defaultKeywords: ['水價', '供水', '水利', '水資源', '缺水', '停水', '減壓', '自來水', '管線', '漏水'],
    searchQuery: 'site:water.gov.tw ("水價" OR "供水" OR "水利" OR "水資源" OR "缺水" OR "停水")',
    fallbackQuery: '("台灣自來水公司" OR "台水") ("水價" OR "供水" OR "水資源" OR "缺水")',
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
    focusDesc: '地熱、油氣',
    defaultKeywords: ['地熱', '油氣', '天然氣', '液化天然氣', 'LNG', '油價', '探勘', '汽柴油'],
    searchQuery: 'site:cpc.com.tw ("地熱" OR "油氣" OR "天然氣")',
    fallbackQuery: '"台灣中油" ("地熱" OR "油氣" OR "天然氣")',
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
    focusDesc: '化工商品及商品檢驗公告',
    defaultKeywords: ['化工', '化學', '商品', '塑膠', '塗料', '檢驗', '標準', '正字標記'],
    searchQuery: 'site:bsmi.gov.tw ("化工" OR "化學" OR "商品")',
    fallbackQuery: '"標準檢驗局" ("化工" OR "化學" OR "商品檢驗")',
    channels: [
      { label: '本局新聞', url: 'https://www.bsmi.gov.tw/wSite/lp?ctNode=8321&CtUnit=963&BaseDSD=7' },
    ],
  },
  {
    id: '3-3-10',
    groupId: '3-3',
    code: '3-3-10',
    name: '地熱發電單一服務窗口',
    focusDesc: '地熱近期活動、政策法規與新聞推動',
    defaultKeywords: ['地熱', '發電', '探勘', '法規', '活動', '示範', '案場', '永續'],
    matchAllByDefault: true,
    searchQuery: 'site:ea01.moeaea.gov.tw OR ("地熱發電單一服務窗口" "地熱")',
    fallbackQuery: '"地熱發電" ("經濟部" OR "能源署" OR "政策" OR "法規")',
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
    focusDesc: '水資源、園區營收、核准投資案（關注水務相關廠商）、AI／半導體',
    defaultKeywords: ['水資源', '水務', '再生水', '營收', '營業額', '核准投資', '投資案', '園區審議', 'AI', '人工智慧', '半導體', '晶片'],
    searchQuery: 'site:nstc.gov.tw ("水資源" OR "營收" OR "營業額" OR "核准投資" OR "投資案" OR "AI" OR "半導體")',
    fallbackQuery: '"國科會" ("水資源" OR "營業額" OR "營收" OR "核准投資" OR "園區審議會" OR "AI" OR "半導體")',
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
    focusDesc: '水資源、營收、核准投資案（關注水務相關廠商）',
    defaultKeywords: ['水資源', '水務', '再生水', '供水', '寶山', '營收', '營業額', '核准投資', '投資案', '入區'],
    searchQuery: 'site:sipa.gov.tw ("水資源" OR "再生水" OR "營收" OR "營業額" OR "投資")',
    fallbackQuery: '("新竹科學園區" OR "竹科管理局") ("水資源" OR "再生水" OR "營收" OR "營業額" OR "核准投資")',
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
    focusDesc: '水資源、營收、核准投資案（關注水務相關廠商）',
    defaultKeywords: ['水資源', '水務', '再生水', '供水', '營收', '營業額', '核准投資', '投資案', '入區', '二期'],
    searchQuery: 'site:ctsp.gov.tw ("水資源" OR "再生水" OR "營收" OR "營業額" OR "投資")',
    fallbackQuery: '("中部科學園區" OR "中科管理局") ("水資源" OR "再生水" OR "營收" OR "營業額" OR "核准投資")',
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
    focusDesc: '水資源、營收、核准投資案（關注水務相關廠商）、沙崙園區',
    defaultKeywords: ['水資源', '水務', '再生水', '水境', '海淡', '供水', '營收', '營業額', '核准投資', '投資案', '沙崙'],
    searchQuery: 'site:stsp.gov.tw ("水資源" OR "營收" OR "營業額" OR "投資" OR "沙崙")',
    fallbackQuery: '("南部科學園區" OR "南科管理局") ("水資源" OR "再生水" OR "營收" OR "營業額" OR "核准投資" OR "沙崙")',
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
    focusDesc: '接受商會建言、科學園區發展、缺水、半導體／AI發展、國家發展計畫（半導體／AI、能源）、委員會議新聞稿',
    defaultKeywords: ['商會', '建言', '白皮書', '科學園區', '缺水', '水資源', '半導體', 'AI', '人工智慧', '國家發展計畫', '能源', '委員會議'],
    searchQuery: 'site:ndc.gov.tw ("商會" OR "科學園區" OR "缺水" OR "水資源" OR "半導體" OR "AI" OR "國家發展計畫" OR "委員會議")',
    fallbackQuery: '"國發會" ("商會" OR "科學園區" OR "缺水" OR "水資源" OR "半導體" OR "AI" OR "國家發展計畫" OR "委員會議")',
    channels: [
      { label: '本會動態', url: 'https://www.ndc.gov.tw/News12_1.aspx?n=3E6699ADB0BE3855&sms=C7BF44606A5BF73F' },
      { label: '新聞稿', url: 'https://www.ndc.gov.tw/News9.aspx?n=114AAE178CD95D4C&sms=DF717169EA26F1A3' },
      { label: '最新消息', url: 'https://www.ndc.gov.tw/News_TopNews.aspx?n=1CE324F4C0BA40AC' },
    ],
  },
  {
    id: '3-6',
    groupId: '3-6',
    code: '3-6',
    name: '環境部（本部／氣候變遷署）',
    focusDesc: '循環經濟、南科沙崙園區（環評）、水質與環境保護澄清',
    defaultKeywords: ['循環經濟', '沙崙', '南科', '環評', '環境影響評估', '水', '淨水', '水質', '碳費', '光電'],
    searchQuery: '(site:cca.gov.tw OR site:moenv.gov.tw) ("循環經濟" OR "沙崙" OR "南科" OR "環評" OR "水質")',
    fallbackQuery: '"環境部" ("循環經濟" OR "沙崙" OR "南科" OR "環評")',
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
    focusDesc: '資源循環、循環經濟政策與即時澄清',
    defaultKeywords: ['資源循環', '循環經濟', '再生', '回收', '再利用', '廢棄物'],
    searchQuery: 'site:reca.gov.tw ("資源循環" OR "循環經濟" OR "再利用")',
    fallbackQuery: '"資源循環署" ("資源循環" OR "循環經濟" OR "再利用")',
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
    focusDesc: '水資源、半導體化學品管理、鼠害防治',
    defaultKeywords: ['水資源', '水質', '飲用水', '全氟', 'PFAS', '半導體', '鼠害', '滅鼠', '殺鼠劑', '老鼠', '化學'],
    searchQuery: 'site:cha.gov.tw ("水" OR "半導體" OR "鼠" OR "化學")',
    fallbackQuery: '("化學物質管理署" OR "化學署") ("水資源" OR "水質" OR "半導體" OR "鼠害" OR "滅鼠")',
    channels: [
      { label: '新聞發布', url: 'https://www.cha.gov.tw/lp-23-1.html' },
    ],
  },
];

const NAV_BLACKLIST = [
  '跳到主要內容',
  '中央內容區塊',
  '按 Enter 到主內容區',
  '網站導覽',
  '隱私權',
  '資訊安全',
  '政府網站資料開放',
  '意見信箱',
  '常見問答',
  '聯絡我們',
  '雙語詞彙',
  '友善列印',
  '轉寄友人',
  '回上一頁',
  '展開選單',
  '相關連結',
  '交通位置',
  '粉絲團',
  '無障礙',
  '首頁',
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

function extractDateFromText(text = '') {
  if (!text) return null;
  // 1) ISO date: 2024-01-01 ~ 2029-12-31
  const iso = text.match(/\b(202[3-9])[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, '0');
    const d = iso[3].padStart(2, '0');
    const dt = new Date(`${y}-${m}-${d}T08:00:00+08:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // 2) ROC Minguo date: 112-01-01 ~ 118-12-31
  const roc = text.match(/(?:^|\D)(11[2-8])[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);
  if (roc) {
    const y = parseInt(roc[1], 10) + 1911;
    const m = roc[2].padStart(2, '0');
    const d = roc[3].padStart(2, '0');
    const dt = new Date(`${y}-${m}-${d}T08:00:00+08:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return null;
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

function evaluateKeywordHit(itemText, defaultKeywords = []) {
  const lower = itemText.toLowerCase();
  const matched = defaultKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
  return matched;
}

/**
 * Slice HTML to focus on Taiwan .gov.tw main content block (accesskey="C" or <main>)
 */
function sliceMainContentRegion(html) {
  let startIdx = 0;
  const markers = [
    /accesskey=["']C["']/i,
    /<main\b/i,
    /id=["'](?:main|content|center|CCMS_Content)["']/i,
    /中央內容區塊/,
  ];
  for (const re of markers) {
    const m = re.exec(html);
    if (m && m.index > 0 && m.index < html.length * 0.85) {
      startIdx = m.index;
      break;
    }
  }

  let endIdx = html.length;
  const endMarkers = [/accesskey=["']Z["']/i, /<footer\b/i, /id=["']footer["']/i];
  for (const re of endMarkers) {
    const m = re.exec(html.slice(startIdx + 200));
    if (m) {
      endIdx = startIdx + 200 + m.index;
      break;
    }
  }
  return html.slice(startIdx, endIdx);
}

async function safeFetchText(url, timeoutMs = 8000) {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

/**
 * Engine A: Scrape direct official government webpage list
 */
async function scrapeOfficialChannel(agency, channel) {
  let html;
  try {
    html = await safeFetchText(channel.url, 7500);
  } catch (_) {
    return [];
  }
  if (!html || html.length < 1000) return [];

  const bodySlice = sliceMainContentRegion(html);
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const extracted = [];
  let match;

  while ((match = anchorRegex.exec(bodySlice)) !== null && extracted.length < 30) {
    const attrs = match[1] || '';
    const innerHtml = match[2] || '';
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    const titleAttrMatch = attrs.match(/title=["']([^"']+)["']/i);
    if (!hrefMatch) continue;

    const rawHref = decodeEntities(hrefMatch[1].trim());
    if (
      !rawHref ||
      rawHref.startsWith('#') ||
      rawHref.startsWith('javascript:') ||
      rawHref.startsWith('mailto:') ||
      rawHref.startsWith('tel:')
    ) {
      continue;
    }

    let fullUrl;
    try {
      fullUrl = new URL(rawHref, channel.url).href;
    } catch (_) {
      continue;
    }

    // Skip external social/login/file-viewer utility links
    if (/facebook\.com|line\.me|twitter\.com|youtube\.com|google\.com\/maps/i.test(fullUrl)) {
      continue;
    }

    let text = stripTags(innerHtml);
    if (text.length < 10 && titleAttrMatch) {
      text = stripTags(titleAttrMatch[1]);
    }
    // Remove "[另開新視窗]" or "(另開新視窗)" suffixes common on .gov.tw
    text = text
      .replace(/[\[（(]\s*另開新視窗\s*[\]）)]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length < 10 || text.length > 200) continue;
    if (text.includes('{{') || text.includes('"+')) continue;
    if (NAV_BLACKLIST.some((bad) => text.includes(bad))) continue;

    // Look in surrounding context (±220 chars around anchor) for publication date
    const ctxStart = Math.max(0, match.index - 220);
    const ctxEnd = Math.min(bodySlice.length, match.index + match[0].length + 220);
    const contextText = stripTags(bodySlice.slice(ctxStart, ctxEnd));
    const dt = extractDateFromText(text) || extractDateFromText(contextText);

    // Strip leading/trailing date strings from title if embedded
    const cleanTitle = text
      .replace(/^(?:202\d|11\d)[\/.\-年]\d{1,2}[\/.\-月]\d{1,2}日?\s*/, '')
      .replace(/\s*(?:202\d|11\d)[\/.\-年]\d{1,2}[\/.\-月]\d{1,2}日?$/, '')
      .trim();

    if (cleanTitle.length < 8) continue;

    const matchedKeywords = evaluateKeywordHit(`${cleanTitle} ${contextText}`, agency.defaultKeywords);
    const isDefaultMatch = Boolean(agency.matchAllByDefault) || matchedKeywords.length > 0;
    const specialBadge = detectSpecialBadge(cleanTitle, channel, agency);

    extracted.push({
      agencyId: agency.id,
      groupId: agency.groupId,
      code: agency.code,
      agencyName: agency.name,
      channelLabel: channel.label,
      channelUrl: channel.url,
      title: cleanTitle,
      link: fullUrl,
      summary: '',
      publishedAt: dt ? dt.toISOString() : null,
      timestamp: dt ? dt.getTime() : 0,
      matchedKeywords,
      isDefaultMatch,
      specialBadge,
      via: 'official-page',
    });
  }

  return extracted;
}

function extractXmlTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decodeEntities(m[1].trim()) : '';
}

function parseRssForAgency(xmlText, agency) {
  if (!xmlText) return [];
  const blocks = xmlText.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  const results = [];

  for (const block of blocks.slice(0, 20)) {
    let rawTitle = extractXmlTag(block, 'title');
    let link = extractXmlTag(block, 'link');
    const pubDateRaw = extractXmlTag(block, 'pubDate');
    let source = extractXmlTag(block, 'source');

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

    let summary = stripTags(extractXmlTag(block, 'description'));
    if (summary && rawTitle && summary.startsWith(rawTitle)) {
      summary = summary.slice(rawTitle.length).replace(/^[\s\-—·|]+/, '').trim();
    }
    if (source && summary === source) summary = '';

    if (!rawTitle || rawTitle.length < 6) continue;
    if (/^(?:風評|社論|觀點投書|星期專論|名家評論)[：:]|\|\s*主筆室\s*\|/.test(rawTitle)) continue;

    const sourceUrlMatch = block.match(/<source[^>]*url=["']([^"']+)["']/i);
    const srcDomain = sourceUrlMatch ? sourceUrlMatch[1] : '';
    const isGovSource = /\.(?:gov\.tw|cpc\.com\.tw)/i.test(srcDomain) || /\.(?:gov\.tw|cpc\.com\.tw)/i.test(link);

    const dt = pubDateRaw ? new Date(pubDateRaw) : null;
    const validDt = dt && !Number.isNaN(dt.getTime()) ? dt : null;

    const matchedKeywords = evaluateKeywordHit(`${rawTitle} ${summary}`, agency.defaultKeywords);
    const isDefaultMatch = Boolean(agency.matchAllByDefault) || matchedKeywords.length > 0;
    const defaultChannel = agency.channels[0] || { label: '官方訊息', url: '#' };
    const specialBadge = detectSpecialBadge(rawTitle, defaultChannel, agency);

    results.push({
      agencyId: agency.id,
      groupId: agency.groupId,
      code: agency.code,
      agencyName: agency.name,
      channelLabel: isGovSource
        ? defaultChannel.label
        : source
        ? `相關動態・${source}`
        : defaultChannel.label,
      channelUrl: defaultChannel.url,
      title: rawTitle,
      link: link || defaultChannel.url,
      summary: summary.slice(0, 200),
      publishedAt: validDt ? validDt.toISOString() : null,
      timestamp: validDt ? validDt.getTime() : 0,
      matchedKeywords,
      isDefaultMatch,
      specialBadge,
      via: 'domain-index',
    });
  }
  return results;
}

/**
 * Engine B: Search Google News RSS for official site:<domain> + fallback agency query
 */
async function fetchAgencySearchSupplement(agency) {
  const urls = [
    `https://news.google.com/rss/search?q=${encodeURIComponent(agency.searchQuery)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
  ];
  if (agency.fallbackQuery) {
    urls.push(
      `https://news.google.com/rss/search?q=${encodeURIComponent(agency.fallbackQuery)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
    );
  }

  const settled = await Promise.allSettled(urls.map((u) => safeFetchText(u, 8000)));
  const items = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      items.push(...parseRssForAgency(s.value, agency));
    }
  }
  return items;
}

function deduplicateGovItems(items) {
  const seen = new Map();
  const out = [];
  for (const it of items) {
    const norm = `${it.agencyId}:${(it.title || '')
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, '')
      .slice(0, 38)}`;
    if (!norm || norm.endsWith(':')) continue;
    if (seen.has(norm)) {
      const existing = seen.get(norm);
      if (!existing.publishedAt && it.publishedAt) {
        existing.publishedAt = it.publishedAt;
        existing.timestamp = it.timestamp;
      }
      existing.matchedKeywords = [...new Set([...(existing.matchedKeywords || []), ...(it.matchedKeywords || [])])];
      if (it.isDefaultMatch) existing.isDefaultMatch = true;
      continue;
    }
    const copy = { ...it };
    seen.set(norm, copy);
    out.push(copy);
  }
  return out;
}

async function fetchSingleAgency(agency) {
  const [directChunks, searchItems] = await Promise.all([
    Promise.all(agency.channels.map((ch) => scrapeOfficialChannel(agency, ch))),
    fetchAgencySearchSupplement(agency),
  ]);

  const directItems = directChunks.flat();
  const merged = deduplicateGovItems([...directItems, ...searchItems]).sort((a, b) => {
    if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp;
    if (a.timestamp && !b.timestamp) return -1;
    if (!a.timestamp && b.timestamp) return 1;
    return 0;
  });

  // Keep up to 18 matched items + up to 8 recent general items per agency so dataset stays crisp & fast
  const matched = merged.filter((x) => x.isDefaultMatch).slice(0, 18);
  const others = merged.filter((x) => !x.isDefaultMatch).slice(0, 8);
  return [...matched, ...others];
}

/**
 * Fetch all 20 government agencies in controlled concurrency batches (5 at a time)
 */
async function fetchGovernmentUpdates() {
  const allItems = [];
  const batchSize = 5;

  for (let i = 0; i < GOV_AGENCIES.length; i += batchSize) {
    const batch = GOV_AGENCIES.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((ag) => fetchSingleAgency(ag)));
    results.forEach((items) => allItems.push(...items));
  }

  // Sort globally: dated items newest-first, undated items after dated ones
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
      channels: ag.channels,
      extraLinks: ag.extraLinks || [],
      matchedCount,
      totalCount: agItems.length,
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
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
