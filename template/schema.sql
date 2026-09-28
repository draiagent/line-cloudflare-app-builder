-- D1 資料表。時間欄位一律存 UTC 毫秒；local_date 為 Asia/Taipei 日期。

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,           -- test_mode（'1'/'0'）、bind_until（毫秒）
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bindings (
  role     TEXT PRIMARY KEY CHECK (role IN ('elder', 'family')),
  line_id  TEXT NOT NULL,           -- 長輩 userId 或家屬 groupId
  bound_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  med        TEXT NOT NULL,
  time       TEXT NOT NULL,         -- HH:MM（Asia/Taipei）
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id  INTEGER NOT NULL REFERENCES schedules(id),
  local_date   TEXT NOT NULL,
  due_at       INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  remind_count INTEGER NOT NULL DEFAULT 1,
  snoozed      INTEGER NOT NULL DEFAULT 0,
  snooze_count INTEGER NOT NULL DEFAULT 0,
  next_at      INTEGER,
  escalated    INTEGER NOT NULL DEFAULT 0,
  claimed_by   TEXT,                -- 按「我來打電話」的家人顯示名稱
  done_at      INTEGER,
  UNIQUE (schedule_id, local_date)
);

CREATE TABLE IF NOT EXISTS call_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         INTEGER NOT NULL,     -- 長輩按「打給家人」的時間
  claimed_by TEXT                  -- 按「我來打電話」的家人顯示名稱
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  reminder_id INTEGER,              -- 提醒的 id；call_family／claim_call 事件時是 call_requests 的 id
  detail      TEXT
);

CREATE INDEX IF NOT EXISTS idx_reminders_open ON reminders (status, due_at);
CREATE INDEX IF NOT EXISTS idx_events_at ON events (at);
