// 從 template/ 建立新 App：node scripts/new-app.mjs <專案資料夾> <app-name>
// - 資料夾可以已存在（例如已放好圖示與 .env.local），但不會覆蓋任何既有檔案。
// - 既有的 .gitignore 會合併缺少的規則，不會整份取代。
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'template');
const [target, name] = process.argv.slice(2);

if (!target || !/^[a-z][a-z0-9-]{1,50}$/.test(name || '')) {
  console.error('用法：node scripts/new-app.mjs <專案資料夾> <app-name>\napp-name 只能用小寫英文、數字、減號，例如 elder-med-assistant');
  process.exit(2);
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(TEMPLATE).map((p) => relative(TEMPLATE, p));
const conflicts = files.filter((f) => f !== '.gitignore' && existsSync(join(target, f)));
if (conflicts.length) {
  console.error('以下檔案已存在，為避免覆蓋已中止：\n' + conflicts.map((f) => '  ' + f).join('\n'));
  process.exit(1);
}

mkdirSync(target, { recursive: true });
for (const f of files) {
  const dst = join(target, f);
  if (f === '.gitignore' && existsSync(dst)) {
    const have = new Set(readFileSync(dst, 'utf8').split(/\r?\n/).map((s) => s.trim()));
    const add = readFileSync(join(TEMPLATE, f), 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#') && !have.has(l.trim()));
    if (add.length) writeFileSync(dst, readFileSync(dst, 'utf8').replace(/\s*$/, '\n') + '\n# line-cloudflare-app-builder\n' + add.join('\n') + '\n');
    console.log(`合併 .gitignore（新增 ${add.length} 條）`);
    continue;
  }
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(join(TEMPLATE, f), dst);
}

for (const f of ['wrangler.toml', 'package.json']) {
  const p = join(target, f);
  writeFileSync(p, readFileSync(p, 'utf8').replaceAll('__APP_NAME__', name));
}

console.log(`已建立 ${name}（${files.length} 個檔案）於 ${target}`);
console.log('下一步：改 src/app/config.js 與 src/app/screens.js，再執行 npm test 與 scripts/preview.mjs');
