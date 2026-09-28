# LINE × Cloudflare App Builder

[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](CHANGELOG.md)

> 把「LINE 提醒類 App」的開發流程封裝成 Claude Skill：標準骨架＋設定腳本＋驗證腳本＋人工檢核清單。新 App 只改業務邏輯。

這是《從許願到部署：AI 打造長輩服藥助理 App 實作講義》中 **L3 範本＋Skill 版** 的實作。第一個案例是「長輩服藥與健康回報管理助理」；同一套骨架可以延伸到餐後血糖提醒、預約提醒、課程報到提醒。

> ⚠️ **v0.5.0 狀態**：骨架依講義規格撰寫，已通過 35 項離線單元測試，**尚未實際部署到 Cloudflare 與 LINE 驗證**。第一次使用請照 [checklist.md](checklist.md) 完整走一遍。

## 能做什麼

| 誰 | 用什麼 | 做什麼 |
|---|---|---|
| 子女／照顧者 | 網頁 App（可加到主畫面） | 用語音或打字設定每日提醒、看最近 7 天紀錄、切換測試模式、綁定 LINE |
| 長輩 | 只有 LINE | 收提醒，按「吃好了」或「等一下」；打字、貼圖、語音由 AI 判讀；按圖文選單「打給家人」通知家屬群組 |
| 家屬群組 | LINE 群組 | 長輩按「打給家人」時收到通知，一樣可以按「我來打電話」接手，長輩會收到「某某會打給你」 |
| 家屬群組 | LINE 群組 | 30 分鐘沒吃才收到通知，按「我來打電話」避免大家同時打 |

提醒規則：等一下 10 分鐘後再提醒；沒回應 15 分鐘再提醒一次（按過等一下就不發）；30 分鐘通知家屬（從原定時間起算）。測試模式縮短為 1／2／3 分鐘。

## 使用方式

在 Claude Code 中：

```text
使用 line-cloudflare-app-builder 技能，
建立「長輩服藥助理」：每日重複提醒、Flex 大按鈕、
15 分鐘再提醒、30 分鐘通知家屬群組。
```

流程與停止點見 [SKILL.md](SKILL.md)；三個階段的完整提示詞見 [examples/elder-med-assistant/](examples/elder-med-assistant/)。

手動執行腳本（需要 Node.js 18 以上）：

```bash
node scripts/new-app.mjs ../elder-med-assistant elder-med-assistant
node scripts/preview.mjs ../elder-med-assistant
node scripts/setup.mjs ../elder-med-assistant
node scripts/verify.mjs ../elder-med-assistant --online
```

## 專案結構

```text
line-cloudflare-app-builder/
├─ SKILL.md                     技能說明：規則、流程、停止點
├─ checklist.md                 人工檢核清單（身份、授權、付款、同意）
├─ scripts/
│  ├─ new-app.mjs               從骨架建立新專案
│  ├─ preview.mjs               LINE 畫面預覽頁＋字數檢查
│  ├─ setup.mjs                 讀 .env.local → D1 → 部署 → 加密變數 → Webhook → 圖文選單
│  ├─ verify.mjs                金鑰外洩、單元測試、線上 Webhook 檢查
│  └─ lib.mjs
├─ template/                    標準骨架（Cloudflare Worker）
│  ├─ src/core/                 共用：狀態機、LINE、Flex、Gemini、安全閘、D1
│  ├─ src/app/                  業務層：config.js、screens.js（新 App 改這裡）
│  ├─ public/                   子女網頁 App、manifest、PWA 圖示與狀態圖示
│  ├─ line/                     官方帳號大頭貼（手動上傳）、圖文選單圖片（自動建立）
│  ├─ tests/                    離線單元測試
│  ├─ schema.sql
│  └─ wrangler.toml
├─ examples/elder-med-assistant/  三階段提示詞
├─ docs/handout-elder-med-assistant.pdf  實作講義
├─ NOTICE.md
├─ README.md
├─ LICENSE
├─ VERSION
└─ CHANGELOG.md
```

## 已知限制

- 「自動回應訊息」、「允許加入群組」、官方帳號大頭貼沒有公開 API，保留為手動步驟。
- LINE Bot MCP Server 不包含設定 Webhook，本技能改用 Messaging API 端點。

## 授權

保留所有權利，詳見 [LICENSE](LICENSE)。第三方素材見 [NOTICE.md](NOTICE.md)。

## Version

**v0.5.0 — 2026-09-28**

**AI Coach 益力康陳董 | 2026 AI to Agent**
