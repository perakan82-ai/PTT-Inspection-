const path = require('path');
const express = require('express');
const multer = require('multer');
const webhookRouter = require('./routes/webhook');
const { router: apiRouter } = require('./routes/api');
const adminRouter = require('./routes/admin');
const cronRouter = require('./routes/cron');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// webhook ต้องใช้ raw body เพื่อตรวจลายเซ็น จึงต้องอยู่ก่อน express.json
app.use('/webhook', webhookRouter);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/admin', adminRouter);
app.use('/api/cron', cronRouter);
app.use('/api', apiRouter);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'] }));
app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'รูปมีขนาดใหญ่เกินไป (สูงสุด 8MB)' : `อัปโหลดไม่สำเร็จ (${err.code})`;
    return res.status(400).json({ error: msg });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' : err.message });
});

module.exports = app;
