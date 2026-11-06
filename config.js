require('dotenv').config();

const liffId = process.env.LIFF_ID || '2012417401-SxDqK7Tt';

const config = {
  port: Number(process.env.PORT) || 3000,
  liffId,
  loginChannelId: process.env.LINE_LOGIN_CHANNEL_ID || liffId.split('-')[0],
  verifyLineToken: process.env.VERIFY_LINE_TOKEN !== 'false',

  lineAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET || '',
  notifyTo: (process.env.LINE_NOTIFY_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  bucket: process.env.SUPABASE_BUCKET || 'photos',

  adminKey: process.env.ADMIN_KEY || '',
  cronSecret: process.env.CRON_SECRET || '',
  stationName: process.env.STATION_NAME || 'สถานีบริการน้ำมัน',
};

const missing = [
  ['SUPABASE_URL', config.supabaseUrl],
  ['SUPABASE_SERVICE_ROLE_KEY', config.supabaseKey],
  ['LINE_CHANNEL_ACCESS_TOKEN', config.lineAccessToken],
  ['ADMIN_KEY', config.adminKey],
].filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  console.warn(`[config] ยังไม่ได้ตั้งค่า: ${missing.join(', ')}`);
}
if (!config.notifyTo.length) {
  console.warn('[config] ยังไม่ได้ตั้ง LINE_NOTIFY_TO ระบบจะไม่ส่งแจ้งเตือนผู้บริหาร');
}

module.exports = config;
