// 時間工具：一律以 Asia/Taipei（UTC+8，台灣沒有日光節約）計算。

export const MIN = 60 * 1000;
export const TZ_OFFSET_MS = 8 * 60 * MIN;

// 把 UTC 毫秒轉成台北的日期（YYYY-MM-DD）與時間（HH:MM）
export function taipeiParts(ms) {
  const iso = new Date(ms + TZ_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), hhmm: iso.slice(11, 16) };
}

// 台北的日期＋時間 → UTC 毫秒
export function taipeiToUtcMs(date, hhmm) {
  return Date.parse(`${date}T${hhmm}:00Z`) - TZ_OFFSET_MS;
}

export function isValidHHMM(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
