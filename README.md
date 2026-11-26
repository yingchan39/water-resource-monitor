# 💧 水資源輿情與立法院發布消息即時監測網

分成左右雙區塊即時觀測 **【水資源】** 相關動態：
1. **第一區域（即時新聞動態）**：匯流 Google 新聞（台灣）與 Bing 新聞（台灣）針對「水資源」之最新媒體報導。
2. **第二區域（立法院發布消息專區）**：整合立法院全球資訊網（`ly.gov.tw`）官方公告與研究報告、立法院開放資料 API（`v2.ly.govapi.tw`）之議案／法案、委員質詢發言（IVOD 逐字稿與公報紀錄）以及國會新聞動態。

---

## 🌐 GitHub Pages 自動部署與定時更新架構

本專案支援 **GitHub Pages 純靜態部署**：
- 內建 GitHub Actions 工作流程（[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)）：
  - 每次推送至 `main` 分支、手動觸發（`workflow_dispatch`），以及 **每 2 小時定時排程（Cron）**，會自動執行 `npm run build:data` 抓取最新新聞與立法院資料輸出至 `public/data/` 並自動部署至 GitHub Pages。
- 前端同時支援 **瀏覽器端即時直連立法院開放資料 API (`v2.ly.govapi.tw`)** 與即時新聞代理檢索，即使在純靜態 GitHub Pages 環境下點擊「立即抓取最新」或輸入自訂關鍵字也能即時查詢。

### 啟用步驟
1. 本專案已內建自動產生並持續更新 `gh-pages` 分支之 GitHub Actions。
2. 前往 GitHub Repository 的 **Settings → Pages**。
3. 在 **Build and deployment → Source** 確認為 **`Deploy from a branch`**，分支選擇 **`gh-pages` / `/ (root)`** 並點擊 **Save**。
4. 網站將發布至 `https://yingchan39.github.io/water-resource-monitor/`，且每 2 小時自動同步最新資料。

---

## 💻 本機開發啟動

```bash
npm start
# 開啟 http://localhost:3000
```
