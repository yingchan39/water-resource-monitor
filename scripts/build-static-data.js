const fs = require('node:fs');
const path = require('node:path');
const { fetchRealtimeNews, fetchLegislativeYuanUpdates } = require('../lib/fetcher');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

const PRESETS = [
  { slug: 'default', keyword: '水資源', mode: 'or' },
  { slug: 'reservoir-single', keyword: '水庫', mode: 'or' },
  { slug: 'recycled-single', keyword: '再生水', mode: 'or' },
  { slug: 'desalination-single', keyword: '海水淡化', mode: 'or' },
  { slug: 'reservoir', keyword: '水資源+水庫', mode: 'or' },
  { slug: 'recycled', keyword: '水資源+再生水', mode: 'or' },
  { slug: 'desalination', keyword: '水資源+海水淡化', mode: 'or' },
];

(async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'public', '.nojekyll'), '');

  const manifest = {
    generatedAt: new Date().toISOString(),
    presets: {},
  };

  for (const preset of PRESETS) {
    console.log(`[build-static-data] 正在抓取關鍵字：【${preset.keyword}】(${preset.mode})...`);
    const [news, ly] = await Promise.all([
      fetchRealtimeNews(preset.keyword, preset.mode),
      fetchLegislativeYuanUpdates(preset.keyword, preset.mode),
    ]);

    const newsFile = `news-${preset.slug}.json`;
    const lyFile = `ly-${preset.slug}.json`;

    fs.writeFileSync(path.join(DATA_DIR, newsFile), JSON.stringify(news, null, 2), 'utf8');
    fs.writeFileSync(path.join(DATA_DIR, lyFile), JSON.stringify(ly, null, 2), 'utf8');

    manifest.presets[preset.keyword] = {
      slug: preset.slug,
      mode: preset.mode,
      newsFile: `./data/${newsFile}`,
      lyFile: `./data/${lyFile}`,
      newsCount: news.total,
      lyCount: ly.total,
    };
    console.log(`  ✓ 新聞 ${news.total} 則 ｜ 立法院訊息 ${ly.total} 則`);
  }

  fs.writeFileSync(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[build-static-data] 完成！靜態資料已輸出至 ${DATA_DIR}`);
})().catch((err) => {
  console.error('[build-static-data] 發生錯誤：', err);
  process.exit(1);
});
