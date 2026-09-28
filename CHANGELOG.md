# Changelog

## [0.2.0] - 2026-09-28

### Added
- 換用新的 App 圖示包：PWA 圖示 192、512、可遮罩 512、iPhone 180、網頁 32，`manifest.json`（App 名稱「吃藥小幫手」）。
- `template/line/`：官方帳號大頭貼 640×640、圖文選單「打給家人」2500×843（圖片；尚未自動建立）。
- 單元測試：檢查 manifest 列出的圖示檔都存在。

### Changed
- 子女網頁 App 標題改為「吃藥小幫手」，加入 favicon 與 iPhone 主畫面圖示；`manifest.webmanifest` 改為 `manifest.json`。
- `scripts/new-app.mjs`：專案資料夾裡已有、且內容完全相同的檔案（例如先放好的圖示）直接略過，不再視為衝突。

## [0.1.0] - 2026-09-28

### Added
- 初始版本。
- `template/`：Cloudflare Worker＋D1＋每分鐘排程骨架；提醒狀態機（等一下 10／沒回應 15／通知家屬 30 分鐘，測試模式 1／2／3）；LINE 簽章驗證、Flex 長輩友善卡片、Gemini 判讀（失敗退回關鍵字）、用藥安全閘、子女網頁 App。
- `scripts/`：new-app、preview、setup、verify（Node.js，無外部套件）。
- 28 項離線單元測試，對應階段 2 的模擬測試情境。
- `checklist.md`、`examples/elder-med-assistant/` 三階段提示詞、實作講義 PDF。

### Known
- 尚未實際部署到 Cloudflare 與 LINE 驗證。

**AI Coach 益力康陳董 | 2026 AI to Agent**
