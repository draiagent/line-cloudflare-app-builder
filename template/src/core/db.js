// D1 資料存取。資料表定義見 schema.sql。

export async function getSetting(db, key, dflt = null) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row ? row.value : dflt;
}

export function setSetting(db, key, value) {
  return db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, String(value)).run();
}

export async function getBinding(db, role) {
  const row = await db.prepare('SELECT line_id FROM bindings WHERE role = ?').bind(role).first();
  return row ? row.line_id : null;
}

export function setBinding(db, role, lineId, now) {
  return db.prepare('INSERT INTO bindings (role, line_id, bound_at) VALUES (?, ?, ?) ON CONFLICT(role) DO UPDATE SET line_id = excluded.line_id, bound_at = excluded.bound_at')
    .bind(role, lineId, now).run();
}

export async function listSchedules(db) {
  return (await db.prepare('SELECT id, med, time, active FROM schedules WHERE active = 1 ORDER BY time').all()).results;
}

export function addSchedule(db, med, time, now) {
  return db.prepare('INSERT INTO schedules (med, time, created_at) VALUES (?, ?, ?)').bind(med, time, now).run();
}

export function removeSchedule(db, id) {
  return db.prepare('UPDATE schedules SET active = 0 WHERE id = ?').bind(id).run();
}

// 建立今天這個時段的提醒；已存在就不重複建立。回傳是否為新建。
export async function createReminder(db, scheduleId, localDate, dueAt) {
  const res = await db.prepare('INSERT OR IGNORE INTO reminders (schedule_id, local_date, due_at) VALUES (?, ?, ?)')
    .bind(scheduleId, localDate, dueAt).run();
  if (!res.meta.changes) return null;
  return getReminderByKey(db, scheduleId, localDate);
}

const REMINDER_COLS = 'r.*, s.med, s.time';

export function getReminderByKey(db, scheduleId, localDate) {
  return db.prepare(`SELECT ${REMINDER_COLS} FROM reminders r JOIN schedules s ON s.id = r.schedule_id WHERE r.schedule_id = ? AND r.local_date = ?`)
    .bind(scheduleId, localDate).first();
}

export function getReminder(db, id) {
  return db.prepare(`SELECT ${REMINDER_COLS} FROM reminders r JOIN schedules s ON s.id = r.schedule_id WHERE r.id = ?`).bind(id).first();
}

export async function openReminders(db, since) {
  return (await db.prepare(`SELECT ${REMINDER_COLS} FROM reminders r JOIN schedules s ON s.id = r.schedule_id WHERE r.status = 'open' AND r.due_at >= ? ORDER BY r.due_at`)
    .bind(since).all()).results;
}

// 最近一筆還沒吃的提醒（長輩打字「吃了」時對應用）
export function latestOpenReminder(db, since) {
  return db.prepare(`SELECT ${REMINDER_COLS} FROM reminders r JOIN schedules s ON s.id = r.schedule_id WHERE r.status = 'open' AND r.due_at >= ? ORDER BY r.due_at DESC LIMIT 1`)
    .bind(since).first();
}

export function saveReminder(db, r) {
  return db.prepare('UPDATE reminders SET status = ?, remind_count = ?, snoozed = ?, snooze_count = ?, next_at = ?, escalated = ?, claimed_by = ?, done_at = ? WHERE id = ?')
    .bind(r.status, r.remind_count, r.snoozed, r.snooze_count || 0, r.next_at ?? null, r.escalated, r.claimed_by ?? null, r.done_at ?? null, r.id).run();
}

// 長輩按「打給家人」的紀錄；家屬按「我來打電話」時記下是誰
export async function createCallRequest(db, now) {
  const res = await db.prepare('INSERT INTO call_requests (at) VALUES (?)').bind(now).run();
  return res.meta.last_row_id;
}

export async function lastCallRequestAt(db) {
  const row = await db.prepare('SELECT MAX(at) AS at FROM call_requests').first();
  return row?.at || 0;
}

export function getCallRequest(db, id) {
  return db.prepare('SELECT id, at, claimed_by FROM call_requests WHERE id = ?').bind(id).first();
}

export function saveCallClaim(db, id, name) {
  return db.prepare('UPDATE call_requests SET claimed_by = ? WHERE id = ? AND claimed_by IS NULL').bind(name, id).run();
}

export function logEvent(db, now, kind, reminderId = null, detail = null) {
  return db.prepare('INSERT INTO events (at, kind, reminder_id, detail) VALUES (?, ?, ?, ?)')
    .bind(now, kind, reminderId, detail == null ? null : String(detail).slice(0, 500)).run();
}

export async function recentLogs(db, since) {
  const reminders = (await db.prepare(`SELECT ${REMINDER_COLS} FROM reminders r JOIN schedules s ON s.id = r.schedule_id WHERE r.due_at >= ? ORDER BY r.due_at DESC`).bind(since).all()).results;
  const events = (await db.prepare('SELECT at, kind, reminder_id, detail FROM events WHERE at >= ? ORDER BY at DESC LIMIT 500').bind(since).all()).results;
  return { reminders, events };
}
