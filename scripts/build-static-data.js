const fs = require('node:fs');
const path = require('node:path');
const { fetchRealtimeNews, fetchLegislativeYuanUpdates } = require('../lib/fetcher');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

const PRESETS = [
  { slug: 'default', keyword: '水資源' },
  { slug: 'reservoir', keyword: '水資源 水庫' },
  { slug: 'recycled', keyword: '水資源 再生水' },
  { slug: 'desalination', keyword: '水資源 海水淡化' },
];

(async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Create .nojekyll in public/ so GitHub Pages serves all assets cleanly
  fs.writeFileSync(path.join(__dirname, '..', 'public', '.nojekyll'), '');

  const manifest = {
    generatedAt: new Date().toISOString(),
    presets: {},
  };

  for (const preset of PRESETS) {
    console.log(`[build-static-data] 正在抓取關鍵字：【${preset.keyword}】...`);
    const [news, ly] = await Promise.all([
      fetchRealtimeNews(preset.keyword),
      fetchLegislativeYuanUpdates(preset.keyword),
    ]);

    const newsFile = `news-${preset.slug}.json`;
    const lyFile = `ly-${preset.slug}.json`;

    fs.writeFileSync(path.join(DATA_DIR, newsFile), JSON.stringify(news, null, 2), 'utf8');
    fs.writeFileSync(path.join(DATA_DIR, lyFile), JSON.stringify(ly, null, 2), 'utf8');

    manifest.presets[preset.keyword] = {
      slug: preset.slug,
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
