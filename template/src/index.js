// Cloudflare Worker 入口：
// - POST /webhook：LINE 事件
// - /api/*：子女網頁 App（需管理密碼）
// - 每分鐘排程：建立到點的提醒、再提醒、通知家屬
// - 其他路徑：public/ 靜態檔（子女網頁 App 與圖示）

import * as line from './core/line.js';
import * as db from './core/db.js';
import { card, checkLimits } from './core/flex.js';
import { tick, press, claim, pickTimings, cooldownPassed } from './core/engine.js';
import { classify, parseSchedule } from './core/ai.js';
import { safeReply, assertNotRedForElder } from './core/safety.js';
import { MIN, taipeiParts, taipeiToUtcMs, isValidHHMM } from './core/time.js';
import { TIMINGS, LIMITS, REPLY, BIND_MODE_MAX_MIN, CALL_FAMILY_COOLDOWN_MIN, PROMPTS } from './app/config.js';
import { screens } from './app/screens.js';

const DAY = 24 * 60 * MIN;
const CATCH_UP = 5 * MIN; // 排程漏跑時，5 分鐘內的提醒仍會補發

const iconBase = (env) => `${env.PUBLIC_URL}/icons`;

function flex(env, name, ctx) {
  const s = screens[name](ctx);
  const issues = checkLimits(s, LIMITS);
  if (issues.length) console.warn('字數超過限制', issues);
  return { screen: s, message: card(s, iconBase(env)) };
}

const toElder = (env, name, ctx) => {
  const { screen, message } = flex(env, name, ctx);
  assertNotRedForElder(screen);
  return message;
};
const toFamily = (env, name, ctx) => flex(env, name, ctx).message;

async function isTestMode(env) {
  return (await db.getSetting(env.DB, 'test_mode', '0')) === '1';
}

// ---------- 排程 ----------

export async function runTick(env, now) {
  const t = pickTimings(await isTestMode(env), TIMINGS);
  const elder = await db.getBinding(env.DB, 'elder');
  const family = await db.getBinding(env.DB, 'family');
  const { date } = taipeiParts(now);

  for (const s of await db.listSchedules(env.DB)) {
    const due = taipeiToUtcMs(date, s.time);
    if (due > now || now - due > CATCH_UP) continue;
    const r = await db.createReminder(env.DB, s.id, date, due);
    if (!r) continue;
    await db.logEvent(env.DB, now, 'remind', r.id, 1);
    if (elder) await safePush(env, elder, toElder(env, 'remind', { med: r.med, reminderId: r.id }), r.id, now);
  }

  for (const r of await db.openReminders(env.DB, now - DAY)) {
    const { r: next, actions } = tick(r, now, t);
    if (!actions.length) continue;
    await db.saveReminder(env.DB, next);
    for (const a of actions) {
      await db.logEvent(env.DB, now, a, r.id, a === 'remind' ? next.remind_count : null);
      if (a === 'remind' && elder) await safePush(env, elder, toElder(env, 'remind', { med: r.med, reminderId: r.id }), r.id, now);
      if (a === 'escalate' && family) await safePush(env, family, toFamily(env, 'alert', { time: r.time, med: r.med, reminderId: r.id }), r.id, now);
    }
  }
}

async function safePush(env, to, message, reminderId, now) {
  try {
    await line.push(env, to, message);
  } catch (e) {
    console.error('push', e.message);
    await db.logEvent(env.DB, now, 'push_error', reminderId, e.message);
  }
}

// ---------- LINE Webhook ----------

async function handleWebhook(req, env, ctx) {
  const body = await req.text();
  const ok = await line.verifySignature(env.LINE_CHANNEL_SECRET, body, req.headers.get('x-line-signature'));
  if (!ok) return new Response('invalid signature', { status: 401 });
  const events = JSON.parse(body).events || [];
  ctx.waitUntil(Promise.all(events.map((ev) => handleEvent(ev, env).catch((e) => console.error('event', e.message)))));
  return new Response('ok');
}

async function bindModeOn(env, now) {
  return Number(await db.getSetting(env.DB, 'bind_until', '0')) > now;
}

async function handleEvent(ev, env) {
  const now = Date.now();
  const src = ev.source || {};

  if (ev.type === 'follow' && src.type === 'user') {
    if (await bindModeOn(env, now)) {
      await db.setBinding(env.DB, 'elder', src.userId, now);
      await db.logEvent(env.DB, now, 'bind_elder');
    }
    return;
  }
  if (ev.type === 'join' && src.type === 'group') {
    if (await bindModeOn(env, now)) {
      await db.setBinding(env.DB, 'family', src.groupId, now);
      await db.logEvent(env.DB, now, 'bind_family');
    }
    return;
  }

  if (ev.type === 'postback') {
    const p = new URLSearchParams(ev.postback.data);
    const a = p.get('a');
    if (a === 'call_family') {
      if (src.userId === (await db.getBinding(env.DB, 'elder'))) return handleCallFamily(env, ev.replyToken, now);
      return;
    }
    const fromFamily = src.type === 'group' && src.groupId === (await db.getBinding(env.DB, 'family'));
    if (a === 'claim_call') {
      const c = fromFamily && (await db.getCallRequest(env.DB, Number(p.get('c'))));
      if (c) await handleClaim(env, ev, src, c, (n) => db.saveCallClaim(env.DB, n.id, n.claimed_by), 'claim_call', now);
      return;
    }
    const r = await db.getReminder(env.DB, Number(p.get('r')));
    if (!r) return;

    if ((a === 'done' || a === 'snooze') && src.userId === (await db.getBinding(env.DB, 'elder'))) {
      return applyPress(env, ev.replyToken, r, a, now);
    }
    if (a === 'claim' && fromFamily) {
      await handleClaim(env, ev, src, r, (n) => db.saveReminder(env.DB, n), 'claim', now);
    }
    return;
  }

  if (ev.type === 'message' && src.type === 'user' && src.userId === (await db.getBinding(env.DB, 'elder'))) {
    return handleElderMessage(env, ev, now);
  }
}

// 家屬按「我來打電話」：服藥通知與「打給家人」共用同一套接手規則
async function handleClaim(env, ev, src, record, save, kind, now) {
  const name = await line.groupMemberName(env, src.groupId, src.userId);
  const { r: next, result } = claim(record, name);
  if (result === 'claimed') {
    await save(next);
    await db.logEvent(env.DB, now, kind, record.id, name);
    // 回覆在群組裡，所有家人都看得到
    await line.reply(env, ev.replyToken, toFamily(env, 'claimed', { name }));
    // 「打給家人」有人接手時，也讓長輩知道誰會打來（主動推播，會計入額度）
    const elder = kind === 'claim_call' && (await db.getBinding(env.DB, 'elder'));
    if (elder) await safePush(env, elder, toElder(env, 'callClaimed', { name }), record.id, now);
    return;
  }
  return line.reply(env, ev.replyToken, { type: 'text', text: `${record.claimed_by}已經在處理了` });
}

// 長輩按圖文選單「打給家人」→ 通知家屬群組。冷卻時間內重複按不再推播，但長輩一樣收到確認。
async function handleCallFamily(env, replyToken, now) {
  const family = await db.getBinding(env.DB, 'family');
  if (!family) {
    await db.logEvent(env.DB, now, 'call_family_unbound');
    return line.reply(env, replyToken, { type: 'text', text: REPLY.fallback });
  }
  if (cooldownPassed(await db.lastCallRequestAt(env.DB), now, CALL_FAMILY_COOLDOWN_MIN)) {
    const id = await db.createCallRequest(env.DB, now);
    await db.logEvent(env.DB, now, 'call_family', id);
    await safePush(env, family, toFamily(env, 'callRequest', { callId: id }), id, now);
  } else {
    await db.logEvent(env.DB, now, 'call_family_repeat');
  }
  return line.reply(env, replyToken, toElder(env, 'callSent', {}));
}

async function applyPress(env, replyToken, r, action, now) {
  const t = pickTimings(await isTestMode(env), TIMINGS);
  const { r: next, result } = press(r, action, now, t);
  if (result === 'already_done') return line.reply(env, replyToken, toElder(env, 'alreadyDone', {}));
  await db.saveReminder(env.DB, next);
  await db.logEvent(env.DB, now, action, r.id);
  if (result === 'done') return line.reply(env, replyToken, toElder(env, 'done', {}));
  return line.reply(env, replyToken, toElder(env, 'snoozed', { minutes: t.snooze }));
}

async function handleElderMessage(env, ev, now) {
  const m = ev.message;
  try {
    let input;
    if (m.type === 'text') input = { text: m.text };
    else if (m.type === 'sticker') input = { text: `（長輩傳了貼圖，關鍵字：${(m.keywords || []).join('、') || '無'}）` };
    else if (m.type === 'audio') input = { audio: { mime: 'audio/mp4', base64: line.toBase64(await line.getContent(env, m.id)) } };
    else input = { text: `（長輩傳了${m.type}）` };

    const { intent, reply } = await classify(env, PROMPTS, input);
    await db.logEvent(env.DB, now, 'elder_message', null, `${m.type}:${intent}`);

    if (intent === 'done' || intent === 'snooze') {
      const r = await db.latestOpenReminder(env.DB, now - DAY);
      if (r) return applyPress(env, ev.replyToken, r, intent, now);
    }
    const text = safeReply(intent, reply, REPLY);
    await db.logEvent(env.DB, now, 'elder_reply', null, text);
    await line.reply(env, ev.replyToken, { type: 'text', text });
  } catch (e) {
    // 絕不把錯誤訊息回給長輩
    console.error('elder message', e.message);
    await line.reply(env, ev.replyToken, { type: 'text', text: REPLY.fallback }).catch(() => {});
  }
}

// ---------- 子女網頁 App API ----------

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

async function handleApi(req, env, url) {
  if (!env.APP_ADMIN_PASSWORD) return json({ error: '尚未設定管理密碼' }, 503);
  const auth = req.headers.get('Authorization') || '';
  if (!line.timingSafeEqual(auth, `Bearer ${env.APP_ADMIN_PASSWORD}`)) return json({ error: '密碼錯誤' }, 401);

  const now = Date.now();
  const path = url.pathname;
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

  if (path === '/api/status' && req.method === 'GET') {
    return json({
      elderBound: !!(await db.getBinding(env.DB, 'elder')),
      familyBound: !!(await db.getBinding(env.DB, 'family')),
      testMode: await isTestMode(env),
      bindUntil: Number(await db.getSetting(env.DB, 'bind_until', '0')),
      timings: pickTimings(await isTestMode(env), TIMINGS),
    });
  }
  if (path === '/api/test-mode' && req.method === 'POST') {
    await db.setSetting(env.DB, 'test_mode', body.on ? '1' : '0');
    await db.logEvent(env.DB, now, body.on ? 'test_mode_on' : 'test_mode_off');
    return json({ testMode: !!body.on });
  }
  if (path === '/api/bind-mode' && req.method === 'POST') {
    const minutes = Math.min(Math.max(Number(body.minutes) || 10, 1), BIND_MODE_MAX_MIN);
    await db.setSetting(env.DB, 'bind_until', now + minutes * MIN);
    return json({ bindUntil: now + minutes * MIN });
  }
  if (path === '/api/schedules' && req.method === 'GET') return json(await db.listSchedules(env.DB));
  if (path === '/api/schedules' && req.method === 'POST') {
    const med = String(body.med || '').trim().slice(0, 20);
    if (!med || !isValidHHMM(body.time)) return json({ error: '藥名或時間格式不正確（HH:MM）' }, 400);
    await db.addSchedule(env.DB, med, body.time, now);
    return json({ ok: true });
  }
  const del = path.match(/^\/api\/schedules\/(\d+)$/);
  if (del && req.method === 'DELETE') {
    await db.removeSchedule(env.DB, Number(del[1]));
    return json({ ok: true });
  }
  if (path === '/api/parse' && req.method === 'POST') {
    try {
      const items = (await parseSchedule(env, PROMPTS, String(body.text || ''))).filter((i) => i.med && isValidHHMM(i.time));
      return json({ items });
    } catch (e) {
      return json({ error: e.message }, 400);
    }
  }
  if (path === '/api/logs' && req.method === 'GET') {
    const days = Math.min(Number(url.searchParams.get('days')) || 7, 31);
    return json(await db.recentLogs(env.DB, now - days * DAY));
  }
  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/webhook' && req.method === 'POST') return handleWebhook(req, env, ctx);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env, url);
    return env.ASSETS.fetch(req);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runTick(env, Date.now()));
  },
};
