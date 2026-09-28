// AI 判讀：Gemini 或 ChatGPT，用 env.AI_PROVIDER 切換（'gemini' 預設／'openai'）。
// 模型名稱從 env 讀（部署時由 Claude 查證當時可用的模型再填入），不寫死在程式裡。
// 任何失敗都退回關鍵字判讀，不讓錯誤訊息傳到長輩手上。

import { toBase64 } from './line.js';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI = 'https://api.openai.com/v1';

export function provider(env) {
  return env.AI_PROVIDER === 'openai' ? 'openai' : 'gemini';
}

export function aiReady(env) {
  return provider(env) === 'openai'
    ? !!(env.OPENAI_API_KEY && env.OPENAI_MODEL)
    : !!(env.GEMINI_API_KEY && env.GEMINI_MODEL);
}

async function geminiJson(env, system, parts) {
  const res = await fetch(`${GEMINI}/${env.GEMINI_MODEL}:generateContent`, {
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

async function openaiJson(env, system, text) {
  const res = await fetch(`${OPENAI}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: text }],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// ChatGPT 路線的語音：先轉文字（需要 OPENAI_TRANSCRIBE_MODEL），再當文字判讀
async function openaiTranscribe(env, audio) {
  if (!env.OPENAI_TRANSCRIBE_MODEL) throw new Error('未設定 OPENAI_TRANSCRIBE_MODEL');
  const form = new FormData();
  form.append('model', env.OPENAI_TRANSCRIBE_MODEL);
  form.append('file', new Blob([audio.bytes], { type: audio.mime }), 'voice.m4a');
  const res = await fetch(`${OPENAI}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI transcribe ${res.status}`);
  return (await res.json()).text || '';
}

// input: { text } 或 { audio: { mime, bytes } }；回傳 { intent, reply }
export async function classify(env, prompts, input) {
  let text = input.text || '';
  if (aiReady(env)) {
    try {
      let out;
      if (provider(env) === 'openai') {
        if (input.audio) text = await openaiTranscribe(env, input.audio);
        out = await openaiJson(env, prompts.classify, text);
      } else {
        const parts = input.audio
          ? [{ inlineData: { mimeType: input.audio.mime, data: toBase64(input.audio.bytes) } }]
          : [{ text }];
        out = await geminiJson(env, prompts.classify, parts);
      }
      if (['done', 'snooze', 'med_question', 'chat'].includes(out.intent)) return out;
    } catch (e) {
      console.error('classify', e.message);
    }
  }
  return { intent: keywordIntent(text), reply: '' };
}

export function keywordIntent(text) {
  if (/幾顆|劑量|補吃|多吃|少吃|停藥|換藥|毫克|mg/i.test(text)) return 'med_question';
  if (/吃了|吃藥了|吃好|吃過|好了/.test(text)) return 'done';
  if (/等一下|等等|晚點|待會/.test(text)) return 'snooze';
  return 'chat';
}

// 子女用語音說的排程 → [{ med, time: 'HH:MM' }]
export async function parseSchedule(env, prompts, text) {
  if (!aiReady(env)) throw new Error('AI 尚未設定，請手動輸入');
  const out = provider(env) === 'openai'
    ? await openaiJson(env, prompts.parseSchedule, text)
    : await geminiJson(env, prompts.parseSchedule, [{ text }]);
  return Array.isArray(out.items) ? out.items : [];
}
