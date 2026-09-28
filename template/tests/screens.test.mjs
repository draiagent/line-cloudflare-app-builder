import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { screens, SAMPLES, ELDER_SCREENS, FAMILY_SCREENS } from '../src/app/screens.js';
import { LIMITS, TIMINGS } from '../src/app/config.js';
import { card, checkLimits, COLORS } from '../src/core/flex.js';
import { assertNotRedForElder } from '../src/core/safety.js';

const all = [...ELDER_SCREENS, ...FAMILY_SCREENS];

test('每個畫面都有列在長輩或家屬清單裡', () => {
  assert.deepEqual(Object.keys(screens).sort(), [...all].sort());
});

for (const name of all) {
  test(`畫面「${name}」：字數、按鈕數、圖示檔存在`, () => {
    const s = screens[name](SAMPLES[name]);
    assert.deepEqual(checkLimits(s, LIMITS), []);
    assert.ok(existsSync(new URL(`../public/icons/${s.icon}`, import.meta.url)), `找不到圖示 ${s.icon}`);
    assert.ok(COLORS[s.color]);
    const msg = card(s, 'https://example.com/icons');
    assert.equal(msg.type, 'flex');
    assert.ok(msg.altText.length > 0 && msg.altText.length <= 400);
  });
}

test('「等一下」的回覆在兩種模式都不超過字數', () => {
  for (const t of [TIMINGS.live, TIMINGS.test]) {
    assert.deepEqual(checkLimits(screens.snoozed({ minutes: t.snooze }), LIMITS), []);
  }
});

test('長輩永遠不會收到紅色畫面', () => {
  for (const name of ELDER_SCREENS) assert.doesNotThrow(() => assertNotRedForElder(screens[name](SAMPLES[name])));
  assert.throws(() => assertNotRedForElder(screens.alert(SAMPLES.alert)));
});

test('黃底畫面一律用深色字', () => {
  assert.equal(COLORS.yellow.fg, '#3D2B00');
});

test('PWA manifest 列出的圖示檔都存在，且有可遮罩版', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  for (const icon of manifest.icons) {
    assert.ok(existsSync(new URL(`../public${icon.src}`, import.meta.url)), `找不到 ${icon.src}`);
  }
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
});

test('「打給家人」的群組通知有「我來打電話」按鈕，並帶著這次的紀錄編號', () => {
  const s = screens.callRequest({ callId: 42 });
  assert.equal(s.buttons.length, 1);
  assert.equal(s.buttons[0].label, '我來打電話');
  assert.equal(s.buttons[0].data, 'a=claim_call&c=42');
});
