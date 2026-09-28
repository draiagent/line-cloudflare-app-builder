// 驗證：node scripts/verify.mjs <專案資料夾> [--online]
// 離線：金鑰沒外洩、單元測試（提醒邏輯、畫面字數、紅色不給長輩、用藥安全）
// --online：已部署的網站與 Webhook（簽章錯誤要擋、正確要收、LINE 驗證）
// 真實 LINE 手機測試無法自動化，請照 checklist.md 親手做。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readEnv, envIgnored, readToml, tomlValue, lineApi, report, summary, projectArg } from './lib.mjs';

const project = resolve(projectArg());
const online = process.argv.includes('--online');
const env = readEnv(project) || {};

// 1. .env.local 不可上傳
report(envIgnored(project), '.env.local 已列入 .gitignore');

// 2. 金鑰值沒有出現在其他檔案（只列檔名，不印值）
const SKIP = new Set(['.env.local', 'node_modules', '.wrangler', '.git', 'preview']);
const walk = (d) => readdirSync(d).flatMap((f) => {
  if (SKIP.has(f)) return [];
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const secrets = Object.values(env).filter((v) => v && v.length >= 8);
const leaks = walk(project).filter((p) => {
  if (statSync(p).size > 2_000_000) return false;
  const text = readFileSync(p, 'latin1');
  return secrets.some((v) => text.includes(v));
});
report(!leaks.length, leaks.length ? `金鑰出現在：${leaks.map((p) => relative(project, p)).join('、')}` : '其他檔案裡沒有金鑰');

// 3. 單元測試
const t = spawnSync('npm test', { cwd: project, shell: true, encoding: 'utf8' });
const m = `${t.stdout}`.match(/ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)/);
report(t.status === 0, m ? `單元測試：通過 ${m[1]}、失敗 ${m[2]}` : '單元測試執行失敗', t.status === 0 ? '' : `${t.stdout}${t.stderr}`.slice(-800));

// 4. 線上
if (online) {
  const url = tomlValue(readToml(project), 'PUBLIC_URL');
  if (!url) {
    report(false, 'wrangler.toml 沒有 PUBLIC_URL', '先執行 scripts/setup.mjs');
  } else {
    const home = await fetch(url);
    report(home.ok, `網頁 App 可開啟（${home.status}）`);

    const noAuth = await fetch(`${url}/api/status`);
    report(noAuth.status === 401, `沒有密碼不能看資料（${noAuth.status}）`);

    const body = JSON.stringify({ destination: 'verify', events: [] });
    const bad = await fetch(`${url}/webhook`, { method: 'POST', body, headers: { 'x-line-signature': 'invalid' } });
    report(bad.status === 401, `假的 LINE 簽章會被擋下（${bad.status}）`);

    if (env.LINE_CHANNEL_SECRET) {
      const sig = createHmac('sha256', env.LINE_CHANNEL_SECRET).update(body).digest('base64');
      const good = await fetch(`${url}/webhook`, { method: 'POST', body, headers: { 'x-line-signature': sig } });
      report(good.ok, `正確的 LINE 簽章會被接受（${good.status}）`);
    }
    if (env.LINE_CHANNEL_ACCESS_TOKEN) {
      const r = await lineApi(env.LINE_CHANNEL_ACCESS_TOKEN, '/v2/bot/channel/webhook/test', 'POST', { endpoint: `${url}/webhook` });
      report(!!r.data?.success, r.data?.success ? 'LINE 官方 Webhook 驗證成功' : `LINE 官方 Webhook 驗證失敗（${r.status}）`);
    }
  }
}

report(null, '真實 LINE 手機測試', '自動測試驗不出字太小、按鈕看不到，請照 checklist.md 親手測');
process.exit(summary() ? 1 : 0);
