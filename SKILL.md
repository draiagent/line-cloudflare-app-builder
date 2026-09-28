---
name: line-cloudflare-app-builder
description: 用標準骨架快速做出「LINE 提醒類」App（Cloudflare Workers＋D1＋每分鐘排程＋LINE Messaging API＋Gemini 或 ChatGPT）。當使用者要做長輩服藥提醒、餐後血糖提醒、預約／報到提醒等「定時推播 → 按鈕回報 → 沒回應再提醒 → 通知家屬或群組」的 LINE App，或提到「line-cloudflare-app-builder」時使用。內含骨架、設定腳本、驗證腳本、畫面預覽與人工檢核清單。
version: 0.7.0
---

# LINE × Cloudflare App Builder

Agent 能接手所有「操作」，但接不走 **身份、授權、付款、同意** 這四件事。
本技能的目標不是「零人工」，而是把人工壓縮成開頭一次性的少數步驟，其餘交給腳本。

## 一律遵守

- **金鑰**：只從專案的 `.env.local` 讀；先確認已列入 `.gitignore`；不可寫進程式碼、不可提交、不可在對話中顯示值。
- **登入與授權由人做**：`npx wrangler login`、`gh auth login`、瀏覽器授權視窗，一律停下來請使用者自己操作。
- **每個階段結束都停下來**，等使用者確認才進入下一階段。不要自行新增需求以外的功能。
- **時區**：Asia/Taipei（UTC+8）。
- **健康照護類 App**：AI 不得提供劑量、補吃、停藥建議，一律回「請依醫師或藥師指示」（`src/core/safety.js` 已強制）。
- **長輩友善**：一則訊息一個大圖示、主標 5 字內、整則 20 字內、最多兩個大按鈕；紅＝警示（只給家屬）、黃＝提醒（深色字）、綠＝通過、藍＝功能。
- **子女網頁 App**：主要按鈕至少 44×44px，手機 360–430px 寬不能橫向溢出。

## 檔案

| 路徑 | 用途 |
|---|---|
| `template/` | 標準骨架，用 `scripts/new-app.mjs` 複製成新專案 |
| `template/src/core/` | 共用：提醒狀態機、LINE、Flex 卡片、AI（Gemini／ChatGPT 切換）、安全閘、D1。**新 App 通常不改** |
| `template/line/` | 官方帳號大頭貼（640×640，手動上傳）、圖文選單圖片（2500×843，`setup.mjs` 自動建立） |
| `template/src/app/` | 業務層：`config.js`（時間、稱呼、AI 提示）、`screens.js`（畫面）。**新 App 主要改這裡** |
| `scripts/new-app.mjs` | 建立新專案（不覆蓋既有檔案，合併 `.gitignore`） |
| `scripts/preview.mjs` | 產生 LINE 畫面預覽頁與字數檢查 |
| `scripts/setup.mjs` | 一鍵設定：D1、部署、加密變數、LINE Webhook |
| `scripts/verify.mjs` | 驗證：金鑰外洩、單元測試；`--online` 檢查線上網站與 Webhook |
| `checklist.md` | 人工檢核清單（只有人能做的步驟） |
| `examples/elder-med-assistant/` | 第一個案例的三階段提示詞 |

## 流程

### 階段 0：準備（人）
請使用者照 `checklist.md`「開工前」完成：開帳號、拿金鑰、把圖示放進專案、填好 `.env.local`。

### 階段 1：計畫書＋畫面預覽（不部署）
1. `node <技能>/scripts/new-app.mjs <專案資料夾> <app-name>`
2. 依需求修改 `src/app/config.js`、`src/app/screens.js`（及 `public/icons/`）。若提醒流程與現有狀態機不同，才改 `src/core/engine.js`，並同步改 `tests/engine.test.mjs`。
3. 在專案資料夾執行 `npm test`，全部通過。
4. `node <技能>/scripts/preview.mjs <專案資料夾>` 產生 `preview/index.html`。
5. 寫開發計畫書：架構、資料表、需要使用者親自操作的步驟、LINE 推播則數試算（回覆與主動推播分開算）、所選 AI（Gemini 或 ChatGPT）的資料使用條款（查證後報告，不替使用者決定）。
6. **停下來**，請使用者把預覽頁給真正的使用者（例如長輩）看，只說一句用途，觀察：字看得清楚嗎、知道按哪裡嗎、按完知道完成了嗎。

### 階段 2：部署＋測試模式
1. 使用者自己完成 `npx wrangler login`。
2. 依使用者選擇設定 `wrangler.toml` 的 `AI_PROVIDER`（`gemini` 或 `openai`），查證目前可用的模型（Gemini 選有免費額度的），告訴使用者選了哪個，填進對應的 `GEMINI_MODEL` 或 `OPENAI_MODEL`；用 ChatGPT 時另填 `OPENAI_TRANSCRIBE_MODEL` 處理長輩語音。`.env.local` 只需填所選那一家的金鑰。
3. `node <技能>/scripts/setup.mjs <專案資料夾>`，逐項回報結果；⚠️ 項目交給使用者手動處理。
4. 網頁 App 開啟「測試模式」（時間縮短為 1／2／3 分鐘），用「開啟綁定」把**使用者自己的 LINE** 與**測試群組**綁上。
5. `node <技能>/scripts/verify.mjs <專案資料夾> --online`。
6. 交給使用者 `checklist.md` 的手機測試步驟。推送到 GitHub 私人儲存庫。**停下來**。

### 階段 3：正式上線
- 3-1：使用者與家人完成加好友、邀請進真正的群組、取得同意；在網頁 App 開啟綁定後重新綁定，關閉測試模式，列出排程請使用者確認，帶使用者做一次真實 LINE 測試。**停下來**，試用一週不改程式。
- 3-2：整理一週紀錄（網頁 App「最近 7 天紀錄」與 `events` 資料表）、實際推播則數、錯誤、AI 回覆有無提到用藥；交付「必須修／建議改／可以不改」清單，由使用者決定。

## 骨架內建的提醒規則

`src/core/engine.js`，每分鐘排程執行一次：

- 到點推送提醒（附兩個按鈕）。
- 按「等一下」：`snooze` 分鐘後再提醒；可重複按。
- 完全沒回應：`noResponse` 分鐘後再提醒一次；**按過「等一下」就不發這一則**。
- `escalate` 分鐘仍沒按完成：通知家屬群組；**從原定時間起算，不因「等一下」延後**。
- 家屬按「我來打電話」：在群組內回覆「某某會打電話」，並推播告訴長輩「某某會打給你」；第二個人按會被告知已有人處理。
- 長輩按圖文選單「打給家人」：不直接撥電話，改為通知家屬群組（藍色，附「我來打電話」按鈕，接手規則同上）；`CALL_FAMILY_COOLDOWN_MIN`（預設 5 分鐘）內重複按只通知一次，長輩每次都收到「已通知家人」。圖文選單由 `setup.mjs` 建立，已有預設選單時不覆蓋。
- 正式：10／15／30 分鐘；測試模式：1／2／3 分鐘（網頁 App 切換，不用改程式碼）。

## 已知限制

- LINE 官方帳號後台的「自動回應訊息」、「允許加入群組」、大頭貼上傳沒有公開 API，保留為手動步驟。
- 綁定靠「綁定模式」期間收到的加好友／入群事件；已經是好友的帳號要先封鎖再解除封鎖，才會再觸發加好友事件。
- 目前只通過離線單元測試，**尚未實際部署到 Cloudflare 與 LINE 驗證**。
