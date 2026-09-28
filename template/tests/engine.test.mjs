// 對應階段 2 自動模擬測試的情境（邏輯層；不含 LINE／Cloudflare 連線）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tick, press, claim, pickTimings } from '../src/core/engine.js';
import { TIMINGS } from '../src/app/config.js';
import { MIN } from '../src/core/time.js';

const T0 = Date.UTC(2026, 0, 1, 0, 0); // 原定提醒時間
const fresh = () => ({ id: 1, due_at: T0, status: 'open', remind_count: 1, snoozed: 0, snooze_count: 0, next_at: null, escalated: 0, claimed_by: null });

// 從 from 到 to 每分鐘跑一次排程，收集 [分鐘, 動作]
function run(r, from, to, t) {
  const log = [];
  for (let m = from; m <= to; m++) {
    const out = tick(r, T0 + m * MIN, t);
    r = out.r;
    for (const a of out.actions) log.push([m, a]);
  }
  return { r, log };
}

for (const mode of ['test', 'live']) {
  const t = pickTimings(mode === 'test', TIMINGS);

  test(`[${mode}] 按「吃好了」→ 記錄完成，之後沒有任何動作`, () => {
    const { r } = press(fresh(), 'done', T0 + 30_000, t);
    assert.equal(r.status, 'done');
    assert.deepEqual(run(r, 0, t.escalate + 5, t).log, []);
  });

  test(`[${mode}] 按「等一下」→ ${t.snooze} 分鐘後再提醒；連按兩次也正確`, () => {
    let { r } = press(fresh(), 'snooze', T0, t);
    let out = run(r, 1, t.snooze, t);
    assert.deepEqual(out.log.filter(([, a]) => a === 'remind'), [[t.snooze, 'remind']]);
    ({ r } = press(out.r, 'snooze', T0 + t.snooze * MIN, t));
    out = run(r, t.snooze + 1, 2 * t.snooze, t);
    assert.deepEqual(out.log.filter(([, a]) => a === 'remind'), [[2 * t.snooze, 'remind']]);
    assert.equal(out.r.snooze_count, 2);
  });

  test(`[${mode}] 完全不回應 → ${t.noResponse} 分鐘再提醒 → ${t.escalate} 分鐘通知家屬`, () => {
    const { log } = run(fresh(), 0, t.escalate + 10, t);
    assert.deepEqual(log, [[t.noResponse, 'remind'], [t.escalate, 'escalate']]);
  });

  test(`[${mode}] 按了「等一下」仍不吃 → ${t.escalate} 分鐘照樣通知家屬；且 ${t.noResponse} 分鐘不發沒回應的提醒`, () => {
    const { r } = press(fresh(), 'snooze', T0, t);
    const { log } = run(r, 1, t.escalate + 10, t);
    assert.ok(log.some(([m, a]) => m === t.escalate && a === 'escalate'), '通知家屬不可延後');
    const reminds = log.filter(([, a]) => a === 'remind').map(([m]) => m);
    assert.deepEqual(reminds, [t.snooze], '只有「等一下」那一則再提醒');
    if (t.snooze !== t.noResponse) assert.ok(!reminds.includes(t.noResponse));
  });

  test(`[${mode}] 已通知家屬後才按「吃好了」→ 記錄完成、不再重複通知`, () => {
    const out = run(fresh(), 0, t.escalate, t);
    const { r } = press(out.r, 'done', T0 + (t.escalate + 1) * MIN, t);
    assert.equal(r.status, 'done');
    assert.deepEqual(run(r, t.escalate + 1, t.escalate + 10, t).log, []);
  });
}

test('已經吃過再按一次 → already_done，不改紀錄', () => {
  const t = TIMINGS.live;
  const { r } = press(fresh(), 'done', T0, t);
  const again = press(r, 'snooze', T0 + MIN, t);
  assert.equal(again.result, 'already_done');
  assert.equal(again.r, r);
});

test('群組有人按「我來打電話」→ 記下是誰；第二個人按會被告知已有人處理', () => {
  const a = claim(fresh(), '小明');
  assert.equal(a.result, 'claimed');
  assert.equal(a.r.claimed_by, '小明');
  const b = claim(a.r, '小華');
  assert.equal(b.result, 'already_claimed');
  assert.equal(b.r.claimed_by, '小明');
});

test('三種計時在測試模式不會落在同一分鐘', () => {
  const { snooze, noResponse, escalate } = TIMINGS.test;
  assert.equal(new Set([snooze, noResponse, escalate]).size, 3);
});
