// 產生 LINE 畫面預覽頁（階段 1 給長輩看的那一頁）：node scripts/preview.mjs <專案資料夾>
// 輸出 <專案>/preview/index.html；字級依 LINE Flex 的大約像素（4xl≈48px、3xl≈35px、xxl≈29px）。
import { mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectArg } from './lib.mjs';

const project = resolve(projectArg());
const load = (p) => import(pathToFileURL(join(project, p)).href);
const { screens, SAMPLES, ELDER_SCREENS, FAMILY_SCREENS } = await load('src/app/screens.js');
const { LIMITS } = await load('src/app/config.js');
const { COLORS, checkLimits, countChars } = await load('src/core/flex.js');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function bubble(name, who) {
  const s = screens[name](SAMPLES[name]);
  const c = COLORS[s.color];
  const issues = checkLimits(s, LIMITS);
  const btnChars = (s.buttons || []).reduce((n, b) => n + countChars(b.label), 0);
  const buttons = (s.buttons || []).map((b) => {
    const bc = COLORS[b.color];
    return `<div class="btn" style="background:${bc.bg};color:${bc.fg};border-color:${bc.fg}">${esc(b.label)}</div>`;
  }).join('');
  return `<figure>
  <figcaption>${who}｜${esc(name)}</figcaption>
  <div class="bubble" style="background:${c.bg};color:${c.fg}">
    <img src="icons/${esc(s.icon)}" alt="">
    <div class="title">${esc(s.title)}</div>
    ${s.text ? `<div class="text">${esc(s.text)}</div>` : ''}
    ${buttons}
  </div>
  <p class="count">字數：主標 ${countChars(s.title)}／內文 ${countChars(s.text || '')}／按鈕 ${btnChars}（圖示上的字另計）
  ${issues.length ? `<br><b class="bad">⚠ ${esc(issues.join('；'))}</b>` : '<br><b class="good">✓ 符合字數限制</b>'}</p>
</figure>`;
}

const html = `<!doctype html>
<html lang="zh-Hant-TW"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LINE 畫面預覽</title>
<style>
  body { margin:0; background:#8CABD9; font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif; }
  main { max-width:420px; margin:0 auto; padding:16px; }
  h1 { color:#fff; font-size:24px; }
  h2 { color:#fff; font-size:20px; margin-top:32px; }
  figure { margin:0 0 28px; }
  figcaption { color:#fff; font-size:14px; margin-bottom:6px; }
  .bubble { border-radius:20px; padding:24px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,.15); }
  .bubble img { width:100%; display:block; }
  .title { font-size:48px; font-weight:900; margin-top:12px; }
  .text { font-size:29px; margin-top:8px; }
  .btn { font-size:35px; font-weight:900; border-radius:16px; padding:20px; margin-top:16px; border:4px solid; }
  .count { background:#fff; border-radius:8px; padding:8px; font-size:14px; }
  .bad { color:#D7263D; } .good { color:#138A3E; }
</style></head><body><main>
<h1>LINE 畫面預覽</h1>
<h2>長輩會看到的</h2>
${ELDER_SCREENS.map((n) => bubble(n, '長輩')).join('\n')}
<h2>家屬群組會看到的（長輩收不到紅色畫面）</h2>
${FAMILY_SCREENS.map((n) => bubble(n, '家屬群組')).join('\n')}
</main></body></html>`;

const out = join(project, 'preview');
mkdirSync(out, { recursive: true });
cpSync(join(project, 'public', 'icons'), join(out, 'icons'), { recursive: true });
writeFileSync(join(out, 'index.html'), html);
console.log(`已產生 ${join(out, 'index.html')}`);
