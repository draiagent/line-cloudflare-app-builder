// ===== 業務設定：新 App 主要改這個檔和 screens.js =====

export const APP = {
  elderCall: '媽媽', // 回覆「記好了，媽媽好棒」用的稱呼
  elderName: '媽媽', // 家屬通知裡怎麼稱呼長輩
};

// 分鐘數。測試模式由子女網頁 App 切換，不用改程式碼。
export const TIMINGS = {
  live: { snooze: 10, noResponse: 15, escalate: 30 },
  test: { snooze: 1, noResponse: 2, escalate: 3 },
};

// 字數限制。countButtons：按鈕文字算不算進「整則」字數（圖示上印的字一律不算）——待確認。
export const LIMITS = { title: 5, total: 20, countButtons: true };

// AI 自由回覆的上限與失敗時的預設回覆
export const REPLY = { maxChars: 20, fallback: '收到了，謝謝' };

// 綁定模式最長幾分鐘
export const BIND_MODE_MAX_MIN = 30;

export const PROMPTS = {
  classify: `你是長輩服藥提醒 LINE 帳號的助理。長輩 60 歲以上，會打字、傳貼圖或語音。
判斷長輩的意思，只輸出 JSON：{"intent": "...", "reply": "..."}
intent 只能是：
- "done"：表示已經吃藥了
- "snooze"：表示等一下、晚點再吃
- "med_question"：任何關於劑量、補吃、多吃、少吃、停藥、換藥的問題
- "chat"：其他
reply：給長輩的回覆，繁體中文，溫暖、20 字以內。
絕對不可以提供任何用藥劑量或補吃建議。`,
  parseSchedule: `把子女的一句話整理成服藥排程，只輸出 JSON：{"items":[{"med":"藥名","time":"HH:MM"}]}
時間用 24 小時制，Asia/Taipei。早上8點 → "08:00"，晚上7點 → "19:00"。
一句話有多個時間就輸出多筆。聽不出藥名時 med 用 "藥"。`,
};
