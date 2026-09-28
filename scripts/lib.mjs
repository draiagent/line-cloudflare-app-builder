// 腳本共用工具。原則：任何金鑰的「值」都不印出來，只印名稱與結果。
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const REQUIRED_KEYS = ['GEMINI_API_KEY', 'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'APP_ADMIN_PASSWORD'];

export function readEnv(project) {
  const p = join(project, '.env.local');
  if (!existsSync(p)) return null;
  const env = {};
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

// .env.local 是否已被 git 忽略（不是 git repo 時改看 .gitignore 內容）
export function envIgnored(project) {
  const git = spawnSync('git', ['-C', project, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  if (git.status === 0) return spawnSync('git', ['-C', project, 'check-ignore', '-q', '.env.local']).status === 0;
  const gi = join(project, '.gitignore');
  if (!existsSync(gi)) return false;
  const lines = readFileSync(gi, 'utf8').split(/\r?\n/).map((s) => s.trim());
  return lines.some((l) => ['.env.local', '.env.*', '.env*', '*.local'].includes(l));
}

export function readToml(project) {
  return readFileSync(join(project, 'wrangler.toml'), 'utf8');
}

export function tomlValue(toml, key) {
  const m = toml.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'));
  return m ? m[1] : null;
}

// 執行 wrangler（Windows 也能跑）。secretInput 會從 stdin 傳入，不會出現在指令列。
export function wrangler(project, args, secretInput) {
  const res = spawnSync(`npx wrangler ${args}`, {
    cwd: project,
    shell: true,
    encoding: 'utf8',
    input: secretInput,
    env: { ...process.env, CI: '1' }, // 關閉互動式提問
  });
  return { ok: res.status === 0, out: `${res.stdout || ''}${res.stderr || ''}` };
}

export async function lineApi(token, path, method = 'GET', body) {
  const res = await fetch(`https://api.line.me${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { ok: res.ok, status: res.status, data };
}

const results = [];
export function report(ok, label, hint = '') {
  results.push({ ok, label });
  console.log(`${ok === null ? '⚠️ ' : ok ? '✅' : '❌'} ${label}${hint ? `\n   → ${hint}` : ''}`);
}
export function summary() {
  const fail = results.filter((r) => r.ok === false).length;
  const warn = results.filter((r) => r.ok === null).length;
  console.log(`\n結果：${results.length - fail - warn} 項通過、${warn} 項需要人工處理、${fail} 項失敗`);
  return fail;
}

export function projectArg() {
  const p = process.argv[2];
  if (!p || p.startsWith('--')) {
    console.error('用法：node <腳本> <專案資料夾> [選項]');
    process.exit(2);
  }
  return p;
}
