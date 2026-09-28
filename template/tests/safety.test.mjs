import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReply, SAFE_MED_REPLY } from '../src/core/safety.js';
import { keywordIntent } from '../src/core/ai.js';
import { verifySignature, toBase64 } from '../src/core/line.js';
import { REPLY } from '../src/app/config.js';

test('問劑量或補吃 → 只回「請依醫師或藥師指示」', () => {
  assert.equal(safeReply('med_question', '可以多吃一顆', REPLY), SAFE_MED_REPLY);
  for (const q of ['忘記吃可以補吃嗎', '要吃幾顆', '可以停藥嗎', '5mg 夠嗎']) {
    assert.equal(keywordIntent(q), 'med_question', q);
  }
});

test('AI 回覆夾帶劑量內容 → 被攔下', () => {
  for (const bad of ['再吃1顆就好', '補吃沒關係', '劑量加倍', '吃 5 mg']) {
    assert.equal(safeReply('chat', bad, REPLY), SAFE_MED_REPLY, bad);
  }
});

test('AI 回覆空白、格式錯或太長 → 用預設回覆，不出現錯誤訊息', () => {
  assert.equal(safeReply('chat', '', REPLY), REPLY.fallback);
  assert.equal(safeReply('chat', undefined, REPLY), REPLY.fallback);
  assert.equal(safeReply('chat', '這是一段非常非常非常非常非常非常非常長的回覆文字', REPLY), REPLY.fallback);
  assert.equal(safeReply('chat', '好喔，謝謝媽媽', REPLY), '好喔，謝謝媽媽');
});

test('關鍵字判讀：吃了／等一下', () => {
  assert.equal(keywordIntent('我吃了'), 'done');
  assert.equal(keywordIntent('等等'), 'snooze');
  assert.equal(keywordIntent('今天天氣很好'), 'chat');
});

test('LINE 簽章：正確的通過，錯的擋下', async () => {
  const secret = 'test-secret';
  const body = '{"destination":"x","events":[]}';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = toBase64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))));
  assert.equal(await verifySignature(secret, body, sig), true);
  assert.equal(await verifySignature(secret, body + ' ', sig), false);
  assert.equal(await verifySignature(secret, body, null), false);
});
