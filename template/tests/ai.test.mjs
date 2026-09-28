// AI 切換：Gemini／ChatGPT 都能判讀；金鑰或模型沒填、或 AI 出錯時退回關鍵字，不丟錯誤給長輩。
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { classify, provider, aiReady, keywordIntent } from '../src/core/ai.js';
import { PROMPTS } from '../src/app/config.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const reply = (body) => async () => new Response(JSON.stringify(body), { status: 200 });

test('AI_PROVIDER 沒填或填錯都用 Gemini；填 openai 用 ChatGPT', () => {
  assert.equal(provider({}), 'gemini');
  assert.equal(provider({ AI_PROVIDER: 'xyz' }), 'gemini');
  assert.equal(provider({ AI_PROVIDER: 'openai' }), 'openai');
});

test('金鑰或模型沒填 → 不呼叫 AI，改用關鍵字', async () => {
  globalThis.fetch = () => { throw new Error('不該呼叫網路'); };
  for (const env of [{}, { GEMINI_API_KEY: 'k' }, { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k' }]) {
    assert.equal(aiReady(env), false);
    assert.equal((await classify(env, PROMPTS, { text: '我已吃藥了' })).intent, 'done');
  }
});

test('Gemini 路線：讀回 JSON 判讀結果', async () => {
  let url = '';
  globalThis.fetch = async (u, o) => { url = u; return reply({ candidates: [{ content: { parts: [{ text: '{"intent":"snooze","reply":"好，等等提醒你"}' }] } }] })(); };
  const out = await classify({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' }, PROMPTS, { text: '晚點' });
  assert.equal(out.intent, 'snooze');
  assert.match(url, /generativelanguage\.googleapis\.com/);
});

test('ChatGPT 路線：讀回 JSON 判讀結果', async () => {
  let url = '';
  globalThis.fetch = async (u) => { url = u; return reply({ choices: [{ message: { content: '{"intent":"done","reply":"好棒"}' } }] })(); };
  const out = await classify({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm' }, PROMPTS, { text: '吃了' });
  assert.equal(out.intent, 'done');
  assert.match(url, /api\.openai\.com\/v1\/chat\/completions/);
});

test('ChatGPT 路線的語音：先轉文字再判讀', async () => {
  const calls = [];
  globalThis.fetch = async (u) => {
    calls.push(u);
    return u.endsWith('/audio/transcriptions')
      ? reply({ text: '我吃過了' })()
      : reply({ choices: [{ message: { content: '{"intent":"done","reply":"好棒"}' } }] })();
  };
  const env = { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', OPENAI_TRANSCRIBE_MODEL: 't' };
  const out = await classify(env, PROMPTS, { audio: { mime: 'audio/mp4', bytes: new Uint8Array([1, 2, 3]) } });
  assert.equal(out.intent, 'done');
  assert.deepEqual(calls.map((u) => u.split('/v1/')[1]), ['audio/transcriptions', 'chat/completions']);
});

test('AI 回傳錯誤 → 退回關鍵字，不丟出例外', async () => {
  globalThis.fetch = async () => new Response('boom', { status: 500 });
  const out = await classify({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm' }, PROMPTS, { text: '等一下' });
  assert.equal(out.intent, 'snooze');
});

test('按鈕文字「我已吃藥了」打字傳來也判讀為完成', () => {
  assert.equal(keywordIntent('我已吃藥了'), 'done');
});
