// 階段 2 一鍵設定：node scripts/setup.mjs <專案資料夾>
// 讀 .env.local → 確認已被 git 忽略 → 建 D1 → 部署 → 寫入加密環境變數 → 設定並驗證 LINE Webhook。
// 需要人登入或授權的步驟（wrangler login）會停下來請人自己做。全程不印出任何金鑰的值。
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { requiredKeys, readEnv, envIgnored, readToml, tomlValue, wrangler, lineApi, report, summary, projectArg } from './lib.mjs';

const project = resolve(projectArg());
const stop = (label, hint) => { report(false, label, hint); summary(); process.exit(1); };

// 1. 金鑰檔
const env = readEnv(project);
if (!env) stop('找不到 .env.local', '把 .env.local.example 複製成 .env.local 並填值');
const REQUIRED_KEYS = requiredKeys(readToml(project));
const missing = REQUIRED_KEYS.filter((k) => !env[k]);
if (missing.length) stop(`.env.local 缺少：${missing.join('、')}`);
report(true, `.env.local 必填欄位都有值（${REQUIRED_KEYS.join('、')}）`);

// 2. 不可上傳
if (!envIgnored(project)) stop('.env.local 沒有被 .gitignore 排除', '先修好 .gitignore，再重跑');
report(true, '.env.local 已列入 .gitignore');

// 3. 專案名稱
let toml = readToml(project);
const name = tomlValue(toml, 'name');
if (!name || name.includes('__')) stop('wrangler.toml 還沒有 App 名稱', '請用 scripts/new-app.mjs 建立專案');

// 4. Cloudflare 登入（人要自己做）
const who = wrangler(project, 'whoami');
if (!who.ok || /not authenticated|You are not logged in/i.test(who.out)) {
  stop('Cloudflare 尚未登入', '請自己在專案資料夾執行：npx wrangler login，在瀏覽器按授權後再重跑本腳本');
}
report(true, 'Cloudflare 已登入');

// 5. 資料庫
const dbName = tomlValue(toml, 'database_name');
if (tomlValue(toml, 'database_id') === '__D1_ID__') {
  const r = wrangler(project, `d1 create ${dbName}`);
  const id = r.out.match(/database_id"?\s*[=:]\s*"([0-9a-f-]{36})"/)?.[1];
  if (!r.ok || !id) stop(`建立 D1 資料庫 ${dbName} 失敗`, r.out.slice(-400));
  toml = toml.replace('__D1_ID__', id);
  writeFileSync(join(project, 'wrangler.toml'), toml);
  report(true, `已建立 D1 資料庫 ${dbName}`);
} else {
  report(true, `D1 資料庫 ${dbName} 已存在`);
}
const schema = wrangler(project, `d1 execute ${dbName} --remote --file=schema.sql`);
if (!schema.ok) stop('建立資料表失敗', schema.out.slice(-400));
report(true, '資料表已建立（可重複執行，不會刪資料）');

// 6. 部署（第一次部署後才知道網址，網址寫回 PUBLIC_URL 再部署一次）
let dep = wrangler(project, 'deploy');
const url = dep.out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0];
if (!dep.ok || !url) stop('部署失敗', dep.out.slice(-400));
if (tomlValue(toml, 'PUBLIC_URL') !== url) {
  toml = toml.replace(/^PUBLIC_URL\s*=\s*"[^"]*"/m, `PUBLIC_URL = "${url}"`);
  writeFileSync(join(project, 'wrangler.toml'), toml);
  dep = wrangler(project, 'deploy');
  if (!dep.ok) stop('第二次部署失敗', dep.out.slice(-400));
}
report(true, `已部署：${url}`);

// 7. 加密環境變數（值從 stdin 傳入，不出現在指令列或畫面）
for (const k of REQUIRED_KEYS) {
  const r = wrangler(project, `secret put ${k}`, env[k]);
  report(r.ok, r.ok ? `已寫入加密變數 ${k}` : `寫入 ${k} 失敗`);
}

// 8. LINE
const token = env.LINE_CHANNEL_ACCESS_TOKEN;
const info = await lineApi(token, '/v2/bot/info');
report(info.ok, info.ok ? 'LINE Channel Access Token 有效' : `LINE Token 無效（${info.status}）`, info.ok ? '' : '到 LINE Developers 重新發行後更新 .env.local');
if (info.ok) {
  const endpoint = `${url}/webhook`;
  const set = await lineApi(token, '/v2/bot/channel/webhook/endpoint', 'PUT', { endpoint });
  report(set.ok, set.ok ? `Webhook 網址已設定：${endpoint}` : `Webhook 網址設定失敗（${set.status}）`);
  const t = await lineApi(token, '/v2/bot/channel/webhook/test', 'POST', { endpoint });
  report(!!t.data?.success, t.data?.success ? 'Webhook 驗證成功' : `Webhook 驗證失敗：${t.data?.statusCode ?? ''} ${t.data?.reason ?? ''}`);
  const st = await lineApi(token, '/v2/bot/channel/webhook/endpoint');
  if (st.data?.active) report(true, 'Webhook 已啟用（Use webhook）');
  else report(null, 'Webhook 尚未啟用', '請到 LINE Developers → Messaging API → 開啟「Use webhook」');
  await setupRichMenu(token);
}

// 圖文選單「打給家人」：整面一顆按鈕，按下 → 通知家屬群組。已有預設選單就不動，避免覆蓋。
async function setupRichMenu(token) {
  const img = join(project, 'line', 'line_richmenu_2500x843.png');
  if (!existsSync(img)) return report(null, '找不到 line/line_richmenu_2500x843.png，略過圖文選單');
  const cur = await lineApi(token, '/v2/bot/user/all/richmenu');
  if (cur.ok && cur.data?.richMenuId) return report(true, '已有預設圖文選單，未變更');
  const made = await lineApi(token, '/v2/bot/richmenu', 'POST', {
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'call-family',
    chatBarText: '打給家人',
    areas: [{ bounds: { x: 0, y: 0, width: 2500, height: 843 }, action: { type: 'postback', data: 'a=call_family', displayText: '打給家人' } }],
  });
  const id = made.data?.richMenuId;
  if (!id) return report(false, `建立圖文選單失敗（${made.status}）`);
  const up = await fetch(`https://api-data.line.me/v2/bot/richmenu/${id}/content`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
    body: readFileSync(img),
  });
  if (!up.ok) return report(false, `上傳圖文選單圖片失敗（${up.status}）`);
  const def = await lineApi(token, `/v2/bot/user/all/richmenu/${id}`, 'POST');
  report(def.ok, def.ok ? '圖文選單「打給家人」已建立並設為預設' : `設為預設失敗（${def.status}）`);
}

// 9. 一定要人做的
report(null, '官方帳號「自動回應訊息」', '沒有公開 API 可關，請到 LINE Official Account Manager 手動關閉');
report(null, '官方帳號「允許加入群組」', '請到 LINE Official Account Manager 手動開啟');
const ai = tomlValue(toml, 'AI_PROVIDER') === 'openai' ? 'OPENAI_MODEL' : 'GEMINI_MODEL';
if (!tomlValue(toml, ai)) report(null, `${ai} 尚未填寫`, '查證目前可用的模型，填入 wrangler.toml 後重新部署；未填時只用關鍵字判讀');
if (ai === 'OPENAI_MODEL' && !tomlValue(toml, 'OPENAI_TRANSCRIBE_MODEL')) report(null, 'OPENAI_TRANSCRIBE_MODEL 尚未填寫', '長輩的語音訊息需要它轉文字；未填時語音只會收到預設回覆');

process.exit(summary() ? 1 : 0);
