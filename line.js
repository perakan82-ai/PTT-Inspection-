const crypto = require('crypto');
const config = require('./config');

const API = 'https://api.line.me/v2/bot/message';

async function callLine(endpoint, body) {
  const res = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.lineAccessToken}`,
      ...(endpoint === 'push' ? { 'X-Line-Retry-Key': crypto.randomUUID() } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE ${endpoint} ${res.status}: ${text}`);
  }
  return true;
}

const pushMessage = (to, messages) => callLine('push', { to, messages });
const replyMessage = (replyToken, messages) => callLine('reply', { replyToken, messages });

/** ส่งหาผู้บริหารทุกคนใน LINE_NOTIFY_TO */
async function notifyManagers(messages) {
  if (!config.notifyTo.length) return { status: 'skipped', error: 'LINE_NOTIFY_TO ว่าง' };
  const results = await Promise.allSettled(config.notifyTo.map((to) => pushMessage(to, messages)));
  const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason.message);
  if (!errors.length) return { status: 'sent', error: null };
  return {
    status: errors.length === results.length ? 'failed' : 'partial',
    error: errors.join(' | ').slice(0, 1000),
  };
}

/** ตรวจลายเซ็น webhook จาก LINE */
function verifySignature(rawBody, signature) {
  if (!config.lineChannelSecret) return true; // ยังไม่ตั้ง secret = ข้ามการตรวจ (ไม่แนะนำบน production)
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', config.lineChannelSecret).update(rawBody).digest();
  const given = Buffer.from(signature, 'base64');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

module.exports = { pushMessage, replyMessage, notifyManagers, verifySignature };
