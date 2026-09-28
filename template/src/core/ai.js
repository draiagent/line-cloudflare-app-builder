// Gemini 判讀。模型名稱從 env.GEMINI_MODEL 讀（部署時由 Claude 查證當時可用、有免費額度的模型再填入）。
// 任何失敗都退回關鍵字判讀，不讓錯誤訊息傳到長輩手上。

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

async function generate(env, system, parts) {
  const res = await fetch(`${ENDPOINT}/${env.GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

// input: { text } 或 { audio: { mime, base64 } }；回傳 { intent, reply }
export async function classify(env, prompts, input) {
  if (env.GEMINI_MODEL && env.GEMINI_API_KEY) {
    try {
      const parts = input.audio
        ? [{ inlineData: { mimeType: input.audio.mime, data: input.audio.base64 } }]
        : [{ text: input.text }];
      const out = await generate(env, prompts.classify, parts);
      if (['done', 'snooze', 'med_question', 'chat'].includes(out.intent)) return out;
    } catch (e) {
      console.error('classify', e.message);
    }
  }
  return { intent: keywordIntent(input.text || ''), reply: '' };
}

export function keywordIntent(text) {
  if (/幾顆|劑量|補吃|多吃|少吃|停藥|換藥|毫克|mg/i.test(text)) return 'med_question';
  if (/吃了|吃好|吃過|好了/.test(text)) return 'done';
  if (/等一下|等等|晚點|待會/.test(text)) return 'snooze';
  return 'chat';
}

// 子女用語音說的排程 → [{ med, time: 'HH:MM' }]
export async function parseSchedule(env, prompts, text) {
  if (!env.GEMINI_MODEL || !env.GEMINI_API_KEY) throw new Error('AI 尚未設定，請手動輸入');
  const out = await generate(env, prompts.parseSchedule, [{ text }]);
  return Array.isArray(out.items) ? out.items : [];
}
