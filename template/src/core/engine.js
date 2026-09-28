// 提醒狀態機（純函式，不碰網路與資料庫，可離線測試）。
//
// 規則：
// - 建立提醒時已推送第一次，remind_count = 1。
// - 按「等一下」：snooze 分鐘後再提醒；可重複按，每次重新計時。
// - 完全沒回應：noResponse 分鐘後再提醒一次；按過「等一下」就不發這一則。
// - escalate 分鐘仍沒按「吃好了」：通知家屬群組；一律從原定提醒時間起算，不因「等一下」延後。
// - 按「吃好了」之後不再有任何動作。

import { MIN } from './time.js';

export function pickTimings(testMode, timings) {
  return testMode ? timings.test : timings.live;
}

// 每分鐘排程呼叫一次；回傳更新後的提醒與要執行的動作（'remind' / 'escalate'）
export function tick(r, now, t) {
  if (r.status === 'done') return { r, actions: [] };
  const n = { ...r };
  const actions = [];

  if (n.snoozed) {
    if (n.next_at != null && now >= n.next_at) {
      actions.push('remind');
      n.next_at = null;
      n.remind_count += 1;
    }
  } else if (n.remind_count === 1 && now >= n.due_at + t.noResponse * MIN) {
    actions.push('remind');
    n.remind_count += 1;
  }

  if (!n.escalated && now >= n.due_at + t.escalate * MIN) {
    actions.push('escalate');
    n.escalated = 1;
  }
  return { r: n, actions };
}

// 長輩按下按鈕（或 AI 判讀出同樣意思）：action = 'done' | 'snooze'
export function press(r, action, now, t) {
  if (r.status === 'done') return { r, result: 'already_done' };
  if (action === 'done') return { r: { ...r, status: 'done', done_at: now }, result: 'done' };
  if (action === 'snooze') {
    return {
      r: { ...r, snoozed: 1, snooze_count: (r.snooze_count || 0) + 1, next_at: now + t.snooze * MIN },
      result: 'snooze',
    };
  }
  throw new Error(`未知的動作：${action}`);
}

// 家屬按「我來打電話」
export function claim(r, name) {
  if (r.claimed_by) return { r, result: 'already_claimed' };
  return { r: { ...r, claimed_by: name }, result: 'claimed' };
}
