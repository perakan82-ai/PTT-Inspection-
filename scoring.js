// เกณฑ์คะแนนอยู่ฝั่ง Server เท่านั้น ฝั่งพนักงานจะไม่เห็นตัวเลขคะแนน
const EMPLOYEE_ITEMS = [
  { key: 'shirt', label: 'เสื้อ', score: 20 },
  { key: 'pants', label: 'กางเกง', score: 20 },
  { key: 'shoes', label: 'รองเท้า', score: 15 },
  { key: 'hat', label: 'หมวก', score: 15 },
  { key: 'name_tag', label: 'ป้ายชื่อ', score: 15 },
  { key: 'car_sign', label: 'ป้ายวางหน้ารถ', score: 15 },
];

const AREA_ITEMS = [
  { key: 'cleanliness', label: 'ความสะอาด', score: 40 },
  { key: 'no_personal_items', label: 'ไม่มีของส่วนตัววางในพื้นที่', score: 30 },
  { key: 'product_cabinet', label: 'ตู้สินค้าเรียบร้อย', score: 30 },
];

const SHIFT_LABELS = { morning: 'กะเช้า', afternoon: 'กะบ่าย', night: 'กะดึก' };
const ROLE_LABELS = { shift_manager: 'ผู้จัดการกะ', captain: 'กัปตัน', cashier: 'แคชเชียร์' };

const FULL_SCORE = 100;

/** ตรวจว่าตอบครบทุกข้อ และเป็น true/false เท่านั้น */
function isComplete(items, checks) {
  return !!checks && items.every((it) => typeof checks[it.key] === 'boolean');
}

/** คำนวณคะแนน: true = ถูกต้องได้คะแนนเต็มข้อนั้น, false = โดนตัดทั้งข้อ */
function scoreItems(items, checks) {
  const results = items.map((it) => ({
    key: it.key,
    label: it.label,
    max: it.score,
    passed: checks[it.key] === true,
  }));
  const score = results.reduce((sum, r) => sum + (r.passed ? r.max : 0), 0);
  const failed = results.filter((r) => !r.passed);
  return { score, results, failed, passed: score === FULL_SCORE && failed.length === 0 };
}

// ป้องกันการแก้เกณฑ์แล้วคะแนนรวมไม่เท่ากับ 100
for (const [name, items] of [['EMPLOYEE_ITEMS', EMPLOYEE_ITEMS], ['AREA_ITEMS', AREA_ITEMS]]) {
  const total = items.reduce((s, i) => s + i.score, 0);
  if (total !== FULL_SCORE) throw new Error(`${name} รวมได้ ${total} ต้องเท่ากับ ${FULL_SCORE}`);
}

module.exports = {
  EMPLOYEE_ITEMS,
  AREA_ITEMS,
  SHIFT_LABELS,
  ROLE_LABELS,
  FULL_SCORE,
  isComplete,
  scoreItems,
};
