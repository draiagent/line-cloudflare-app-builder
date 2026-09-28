# Changelog

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
