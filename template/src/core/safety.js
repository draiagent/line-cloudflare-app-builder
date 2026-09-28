// 安全閘：AI 的回覆送出前一定經過這裡。

export const SAFE_MED_REPLY = '請依醫師或藥師指示';

// 任何像劑量、補吃、停藥的內容都不准由 AI 說出口
const MED_ADVICE = /(\d+(\.\d+)?\s*(顆|粒|錠|包|次|mg|毫克|cc|ml))|劑量|補吃|多吃|少吃|加倍|減半|停藥|換藥/i;

export function safeReply(intent, aiReply, { fallback, maxChars }) {
  if (intent === 'med_question') return SAFE_MED_REPLY;
  if (typeof aiReply !== 'string' || !aiReply.trim()) return fallback;
  const text = aiReply.trim();
  if (MED_ADVICE.test(text)) return SAFE_MED_REPLY;
  if ([...text].length > maxChars) return fallback;
  return text;
}

// 紅色畫面只給家屬，長輩永遠收不到
export function assertNotRedForElder(screen) {
  if (screen.color === 'red') throw new Error('紅色畫面不可發給長輩');
  return screen;
}
