const crypto = require('crypto');
const config = require('./config');

// แคชผลตรวจ token 5 นาที ลดการเรียก LINE API ซ้ำ
const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;

/**
 * ตรวจ LIFF access token (liff.getAccessToken()) กับ LINE
 * - ต้องเป็น token ของ LINE Login channel ที่ผูก LIFF นี้
 * - ดึง userId / displayName จาก token จริง (ปลอมจากฝั่ง client ไม่ได้)
 */
async function verifyLineAccessToken(token) {
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit.user;

  const v = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(token)}`);
  if (!v.ok) throw new Error('token ไม่ถูกต้องหรือหมดอายุ');
  const info = await v.json();
  if (String(info.client_id) !== String(config.loginChannelId)) throw new Error('token ไม่ได้มาจาก LIFF ของระบบนี้');
  if (!(info.expires_in > 0)) throw new Error('token หมดอายุ');

  const p = await fetch('https://api.line.me/v2/profile', { headers: { Authorization: `Bearer ${token}` } });
  if (!p.ok) throw new Error('ดึงโปรไฟล์ LINE ไม่สำเร็จ');
  const profile = await p.json();

  const user = { userId: profile.userId, displayName: profile.displayName };
  cache.set(token, { user, exp: Date.now() + Math.min(CACHE_MS, info.expires_in * 1000) });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return user;
}

async function requireLineUser(req, res, next) {
  if (!config.verifyLineToken) {
    req.lineUser = { userId: null, displayName: req.get('x-dev-name') || 'ทดสอบ (dev)' };
    return next();
  }
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'กรุณาเปิดผ่านแอป LINE' });
  try {
    req.lineUser = await verifyLineAccessToken(token);
    next();
  } catch (err) {
    res.status(401).json({ error: 'ยืนยันตัวตน LINE ไม่สำเร็จ กรุณาปิดแล้วเปิดใหม่', detail: err.message });
  }
}

function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key') || '';
  const expected = config.adminKey;
  const ok =
    expected &&
    key.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(key), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'รหัสแอดมินไม่ถูกต้อง' });
  next();
}

module.exports = { requireLineUser, requireAdmin };
