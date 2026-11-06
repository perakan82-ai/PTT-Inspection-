# ระบบประเมินมาตรฐานพนักงานและพื้นที่ปั๊มน้ำมันผ่าน LINE

LIFF Web App + Node.js Express + Supabase + LINE Flex Message Alert

## โครงสร้างไฟล์

```
pump-inspection/
├── api/index.js              # Entry สำหรับ Vercel (serverless)
├── public/                   # Front-end (เสิร์ฟโดย Express / Vercel static)
│   ├── index.html            # LIFF App สำหรับพนักงาน (3 ขั้นตอน + หน้าบันทึกสำเร็จ)
│   ├── app.js                # Logic ฝั่ง LIFF (ไม่มีเกณฑ์คะแนน ไม่แสดง PASS/FAIL)
│   ├── admin.html / admin.js # หน้าแอดมิน: จัดการพนักงาน+รูปประจำตัว, ดูประวัติ, ทดสอบแจ้งเตือน
│   └── common.js             # ย่อรูปก่อนอัปโหลด, toast, avatar
├── src/
│   ├── server.js             # Entry สำหรับ Render / รันบนเครื่อง
│   ├── app.js                # Express app
│   ├── config.js             # อ่านค่า Environment
│   ├── scoring.js            # ★ เกณฑ์คะแนน + Logic PASS/FAIL (อยู่ฝั่ง Server เท่านั้น)
│   ├── flex.js               # ★ สร้าง Flex Message สีเขียว (PASS) / สีแดง (FAIL)
│   ├── line.js               # Push/Reply Messaging API + ตรวจลายเซ็น webhook
│   ├── auth.js               # ตรวจ LIFF access token กับ LINE, ตรวจรหัสแอดมิน
│   ├── summary.js            # ★ สรุปรายวัน + หาคนที่ยังไม่ได้ประเมิน
│   ├── supabase.js           # Supabase client + อัปโหลดรูป
│   └── routes/
│       ├── api.js            # /api/config, /api/employees, /api/inspections
│       ├── admin.js          # /api/admin/*
│       ├── cron.js           # /api/cron/daily-summary (ส่งสรุปอัตโนมัติ)
│       └── webhook.js        # /webhook (พิมพ์ "id" ในกลุ่มเพื่อดู groupId)
├── supabase/schema.sql       # ตาราง + Storage bucket
├── samples/                  # ตัวอย่าง Flex JSON สำหรับลองใน Flex Simulator
├── render.yaml / vercel.json
└── .env.example
```

## Logic การให้คะแนน

| ส่วน | รายการ (คะแนน) | เต็ม |
|---|---|---|
| พนักงาน (รายคน) | เสื้อ 20, กางเกง 20, รองเท้า 15, หมวก 15, ป้ายชื่อ 15, ป้ายวางหน้ารถ 15 | 100 |
| พื้นที่ | ความสะอาด 40, ไม่มีของส่วนตัว 30, ตู้สินค้า 30 | 100 |

- ผู้ประเมินกด **✓ ถูกต้อง / ✗ ไม่ถูกต้อง** ทุกข้อ ระบบส่งไปแค่ true/false ส่วนคะแนนคำนวณที่ Server
- **PASS** = พนักงานทุกคนได้ 100 และพื้นที่ได้ 100 / ถ้ามีข้อใดไม่ผ่าน = **FAIL** ทันที
- รูปพื้นที่ **บังคับ** / รูปพนักงานบังคับเฉพาะเมื่อมีข้อไม่ถูกต้อง (ใช้เป็นหลักฐานใน Fail Alert)
- พนักงานเห็นแค่หน้า "บันทึกสำเร็จ" API ก็ตอบกลับแค่ `{ ok: true }`
- แก้เกณฑ์ได้ที่ `src/scoring.js` (ระบบจะ error ถ้าคะแนนรวมไม่เท่ากับ 100)

## รูปประจำตัวพนักงาน

เข้า `https://<โดเมน>/admin` ใส่ `ADMIN_KEY` แล้วเพิ่มพนักงาน (ชื่อ, ชื่อเล่น, ตำแหน่ง, รูป) รูปจะแสดง
- ในหน้าเลือกพนักงานเข้ากะ (การ์ดรูป + ชื่อเล่น)
- รูปใหญ่ตอนประเมินทีละคน ผู้ประเมินจะได้รู้ว่ากำลังประเมินใคร
- ใน Fail Alert ถ้าไม่มีรูปหลักฐาน ระบบจะใช้รูปประจำตัวแทน

ถ้าพนักงานลาออก ให้ปิดใช้งานแทนการลบ ประวัติการประเมินจะยังอยู่ครบ

## สรุปรายวัน + ตารางคนที่ยังไม่ได้ประเมิน

**หน้าแอดมิน → แท็บ 📊 สรุปรายวัน**
- เลือกวันที่ได้ (ปุ่ม ‹ › เลื่อนทีละวัน) นับตามเวลาไทย 00:00–23:59
- การ์ดสรุป: ประเมินแล้ว x/y คน, ยังไม่ได้ประเมิน, จำนวนรอบที่ PASS/FAIL
- สถานะรายกะ: กะไหนส่งแล้ว (เวลาส่งล่าสุด, ผู้ประเมิน) และกะไหน **⏳ ยังไม่ส่ง**
- ตารางพนักงานทุกคนที่ active พร้อมรูป มีคอลัมน์ เช้า / บ่าย / ดึก (✓/✗ + คะแนน + เวลา)
  แถว "ยังไม่ได้ประเมิน" จะขึ้นเป็นกลุ่มแรกและไฮไลต์สีเหลือง
- ติ๊ก "แสดงเฉพาะคนที่ยังไม่ได้ประเมิน" เพื่อดูเฉพาะกลุ่มนี้ / ดาวน์โหลด CSV (เปิดใน Excel ได้ ภาษาไทยไม่เพี้ยน)
- ปุ่ม **ส่งสรุปเข้า LINE** ส่งสรุปของวันที่เลือกได้ทันที

**ส่งสรุปเข้า LINE อัตโนมัติทุกวัน** เป็น Flex Carousel 3 หน้า: สรุปรายกะ, ตาราง ⏳ ยังไม่ได้ประเมิน, ตาราง ❌ คนที่ไม่ผ่าน (แยกเช้า/บ่าย/ดึก พร้อมเหตุผล)

ตั้ง `CRON_SECRET` ใน Environment แล้วเลือกวิธีใดวิธีหนึ่ง:
- **Vercel:** ตั้งไว้ใน `vercel.json` แล้ว (`30 16 * * *` UTC = **23:30 น. เวลาไทย**) Vercel จะส่ง `Authorization: Bearer <CRON_SECRET>` ให้เอง
- **Render / ที่อื่น:** ใช้ https://cron-job.org (ฟรี) ตั้งเวลา 23:30 Asia/Bangkok ให้เรียก
  `GET https://<โดเมน>/api/cron/daily-summary?key=<CRON_SECRET>`
  (cron-job.org ช่วยปลุก Render plan free ให้ด้วย)
- ถ้ากะดึกประเมินหลังเที่ยงคืน แนะนำส่งตอนเช้าแทน เช่น 07:00 น. แล้วใช้ `?offset=-1` เพื่อสรุปของเมื่อวาน

> "ยังไม่ได้ประเมิน" = พนักงานที่ active แต่ไม่ถูกเลือกในการประเมินกะใดเลยของวันนั้น
> ระบบยังไม่มีตารางกะ จึงไม่รู้ว่าใครหยุดหรือลา คนที่ลาก็จะขึ้นในรายชื่อนี้ด้วย

---

## ขั้นตอนติดตั้ง

### 1) Supabase
1. สร้างโปรเจกต์ที่ https://supabase.com (เลือก Region Singapore)
2. **SQL Editor** → วางไฟล์ `supabase/schema.sql` → Run (สร้างตารางและ bucket `photos` แบบ public)
3. **Project Settings → API** คัดลอก `Project URL` และ `service_role` key
   (service_role ใช้ฝั่ง Server เท่านั้น ห้ามใส่ใน front-end)

### 2) LINE Developers Console
- **LINE Login channel** (ที่มี LIFF `2012417401-SxDqK7Tt`)
  - LIFF → Endpoint URL = `https://<โดเมนที่ deploy>/`
  - Scope: `profile`, `openid` / Size: `Full`
  - Channel ID ของ LINE Login channel ต้องตรงกับ `LINE_LOGIN_CHANNEL_ID` (ปกติคือ `2012417401`)
- **Messaging API channel** (บอทที่ส่งแจ้งเตือน)
  - คัดลอก Channel access token (long-lived) และ Channel secret
  - Webhook URL = `https://<โดเมน>/webhook` → เปิด **Use webhook**
  - ปิด Auto-reply messages, เปิด **Allow bot to join group chats**

### 3) หา ID ผู้รับแจ้งเตือน
- **ส่งเข้ากลุ่มผู้บริหาร (แนะนำ):** เชิญบอทเข้ากลุ่ม บอทจะตอบ `groupId` ให้ (หรือพิมพ์ `id` ในกลุ่ม)
- **ส่งรายคน:** ผู้บริหารแอดบอทเป็นเพื่อนแล้วพิมพ์ `id` จะได้ `userId`
- ใส่ใน `LINE_NOTIFY_TO` คั่นด้วย `,` เช่น `Cxxxxxxxx,Uyyyyyyyy`
- กดปุ่ม "🔔 ทดสอบแจ้งเตือน" ในหน้า /admin เพื่อเช็ค

### 4) รันบนเครื่อง (ทดสอบ)
```bash
npm install
cp .env.example .env   # แล้วกรอกค่าจริง
npm run dev            # http://localhost:3000/admin
```
LIFF ต้องใช้ HTTPS ถ้าจะทดสอบบนมือถือจากเครื่องตัวเอง ใช้ `ngrok http 3000` แล้วตั้ง Endpoint URL ชั่วคราว

---

## Deploy

### ทางเลือก A: Render (แนะนำ ตั้งค่าง่ายที่สุด)
1. Push โค้ดขึ้น GitHub (ไฟล์ `.env` ถูก ignore ไว้แล้ว)
2. Render → **New → Blueprint** → เลือก repo (อ่านจาก `render.yaml`)
   หรือ **New → Web Service**: Build `npm install`, Start `npm start`
3. ใส่ Environment Variables ตาม `.env.example`
4. ได้ URL `https://pump-inspection-line.onrender.com` → ไปตั้งเป็น LIFF Endpoint และ Webhook URL
5. Plan Free จะหลับเมื่อไม่มีคนใช้ 15 นาที และครั้งแรกที่เปิดอาจรอ ~30-50 วินาที
   ถ้าใช้งานจริง แนะนำ plan Starter หรือตั้ง cron ping `/health` ทุก 10 นาที

### ทางเลือก B: Vercel
1. Import repo ที่ https://vercel.com/new (Framework Preset: **Other**)
2. ใส่ Environment Variables เหมือนด้านบน → Deploy
3. `public/` เป็น static, `/api/*` และ `/webhook` วิ่งเข้า `api/index.js` (ตาม `vercel.json`)
4. ข้อจำกัด: request body สูงสุด **4.5MB** ฝั่ง LIFF ย่อรูปเหลือ ~150-300KB ต่อรูปให้แล้ว
   ส่งได้ประมาณ 10-15 รูปต่อครั้ง ถ้าพนักงานต่อกะเยอะกว่านี้ให้ใช้ Render

---

## API สรุป
| Method | Path | Auth | หน้าที่ |
|---|---|---|---|
| GET | `/api/config` | - | กะ/บทบาท/รายการประเมิน (ไม่มีคะแนน) |
| GET | `/api/employees` | LIFF token | รายชื่อพนักงาน active + รูป |
| POST | `/api/inspections` | LIFF token | บันทึกผล (multipart: `payload`, `area_photo`, `emp_photo_<id>`) |
| GET/POST/PUT/DELETE | `/api/admin/employees` | `x-admin-key` | จัดการพนักงาน |
| GET | `/api/admin/inspections` | `x-admin-key` | ประวัติ 50 รายการล่าสุด |
| GET | `/api/admin/daily-summary?date=YYYY-MM-DD` | `x-admin-key` | สรุปรายวัน + คนที่ยังไม่ได้ประเมิน |
| POST | `/api/admin/daily-summary/send` | `x-admin-key` | ส่งสรุปรายวันเข้า LINE |
| GET | `/api/cron/daily-summary` | `CRON_SECRET` | ส่งสรุปอัตโนมัติ (`?offset=-1` = เมื่อวาน) |
| POST | `/api/admin/test-notify` | `x-admin-key` | ทดสอบส่ง LINE |
| POST | `/webhook` | LINE signature | ตอบ groupId/userId |

## ความปลอดภัย
- อย่า commit Channel Access Token / service_role key ลง GitHub ให้ใส่ใน Environment ของ Render/Vercel เท่านั้น
- ถ้า token เคยถูกส่งในแชทหรือที่สาธารณะ ให้กด **Reissue** ใน LINE Developers Console
- Backend ตรวจ LIFF access token กับ LINE ทุกครั้ง (ตรวจ `client_id` ด้วย) ชื่อผู้ประเมินจึงปลอมไม่ได้
- ตาราง Supabase เปิด RLS ไว้และไม่มี policy คนนอกที่มี anon key จึงอ่านหรือเขียนไม่ได้
- รูปใน bucket `photos` เป็น public URL (LINE ต้องดึงรูปไปแสดงใน Flex) แต่ชื่อไฟล์เป็น UUID เดาไม่ได้
