// LINE Messaging API 最小封裝。金鑰只從 env 讀，不寫進程式碼。

const API = 'https://api.line.me';
const DATA_API = 'https://api-data.line.me';

export function toBase64(bytes) {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

// 驗證 x-line-signature（HMAC-SHA256，Base64）
export async function verifySignature(secret, body, signature) {
  if (!secret || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return timingSafeEqual(toBase64(mac), signature);
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function call(env, path, payload, method = 'POST') {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) throw new Error(`LINE ${path} ${res.status} ${await res.text()}`);
  return res;
}

export const reply = (env, replyToken, messages) =>
  call(env, '/v2/bot/message/reply', { replyToken, messages: [].concat(messages) });

export const push = (env, to, messages) =>
  call(env, '/v2/bot/message/push', { to, messages: [].concat(messages) });

export async function groupMemberName(env, groupId, userId) {
  try {
    const res = await call(env, `/v2/bot/group/${groupId}/member/${userId}`, null, 'GET');
    return (await res.json()).displayName || '家人';
  } catch {
    return '家人';
  }
}

// 下載語音等訊息內容（回傳 Uint8Array）
export async function getContent(env, messageId) {
  const res = await fetch(`${DATA_API}/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`LINE content ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
