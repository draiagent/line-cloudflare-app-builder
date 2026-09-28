# Changelog

## [0.5.0] - 2026-09-28

### Added
- 「打給家人」有家人按「我來打電話」後，也推播告訴長輩「家人會打來／某某會打給你」（藍色；名字超過 8 字會截短）。服藥通知的接手不變，只通知群組。
- 單元測試共 35 項。

### Changed
- 階段 1、階段 2 提示詞與手機測試清單同步更新。

## [0.4.0] - 2026-09-28

### Added
- 「打給家人」的家屬群組通知加上「我來打電話」按鈕：第一個按的人在群組看到「某某會打電話」，其他人再按會看到「已經在處理了」。
- D1 新增 `call_requests` 資料表（重跑 `setup.mjs` 即可建立，不影響既有資料）。
- 單元測試共 33 項。

### Changed
- 「打給家人」冷卻時間改由 `call_requests` 最新一筆判斷，不再使用 `settings.last_call_family`。
- 服藥通知與「打給家人」的接手共用同一段程式。
- 階段 1、階段 2 提示詞與手機測試清單同步更新。

## [0.3.0] - 2026-09-28

### Added
- 圖文選單「打給家人」：長輩按下後不直接撥電話，改為通知家屬群組（藍色「媽媽找你」），長輩收到「已通知家人」；5 分鐘內重複按只通知一次（`CALL_FAMILY_COOLDOWN_MIN`）。
- `scripts/setup.mjs`：用 LINE API 建立圖文選單、上傳 `line/line_richmenu_2500x843.png` 並設為預設；已有預設選單時不覆蓋。
- 單元測試：冷卻時間、新畫面的字數與顏色（共 32 項）。
- 階段 1 提示詞新增第 8 點；手機測試清單新增「打給家人」項目。

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
