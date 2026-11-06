// สรุปผลรายวัน (ตามเวลาไทย) + รายชื่อพนักงานที่ยังไม่ได้ประเมิน
const config = require('./config');
const { supabase } = require('./supabase');
const { SHIFT_LABELS } = require('./scoring');

const TZ = 'Asia/Bangkok';

/** วันที่วันนี้ (เวลาไทย) รูปแบบ YYYY-MM-DD, offsetDays เช่น -1 = เมื่อวาน */
function bangkokDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('sv-SE', { timeZone: TZ });
}

function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00+07:00`));
}

function thaiDateText(date) {
  return new Date(`${date}T12:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: TZ, dateStyle: 'full' });
}

const timeText = (iso) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/**
 * @param {string} date YYYY-MM-DD (เวลาไทย)
 */
async function buildDailySummary(date) {
  const start = new Date(`${date}T00:00:00+07:00`).toISOString();
  const end = new Date(new Date(`${date}T00:00:00+07:00`).getTime() + 86400000).toISOString();

  const [{ data: inspections, error: e1 }, { data: employees, error: e2 }] = await Promise.all([
    supabase
      .from('inspections')
      .select('id, shift, result, area_score, evaluator_name, created_at, inspection_employees(employee_id, employee_name, score, passed, items)')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at'),
    supabase.from('employees').select('id, name, nickname, position, photo_url').eq('active', true).order('name'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  // สถานะรายกะ
  const shifts = Object.entries(SHIFT_LABELS).map(([key, label]) => {
    const list = inspections.filter((i) => i.shift === key);
    return {
      key,
      label,
      submitted: list.length > 0,
      count: list.length,
      pass: list.filter((i) => i.result === 'PASS').length,
      fail: list.filter((i) => i.result === 'FAIL').length,
      lastAt: list.length ? timeText(list[list.length - 1].created_at) : null,
      evaluators: [...new Set(list.map((i) => i.evaluator_name).filter(Boolean))],
    };
  });

  // ผลรายคน: { empId: { morning: {...}, afternoon: ..., night: ... } }
  const recordsByEmp = new Map();
  for (const insp of inspections) {
    for (const r of insp.inspection_employees || []) {
      if (!r.employee_id) continue;
      if (!recordsByEmp.has(r.employee_id)) recordsByEmp.set(r.employee_id, {});
      const byShift = recordsByEmp.get(r.employee_id);
      // ถ้าประเมินซ้ำในกะเดียวกัน ใช้ผลล่าสุด
      byShift[insp.shift] = {
        score: r.score,
        passed: r.passed,
        time: timeText(insp.created_at),
        failed: (r.items || []).filter((x) => !x.passed).map((x) => x.label),
      };
    }
  }

  const rows = employees.map((e) => {
    const byShift = recordsByEmp.get(e.id) || {};
    const evaluated = Object.keys(byShift).length > 0;
    const anyFail = Object.values(byShift).some((r) => !r.passed);
    return {
      id: e.id,
      name: e.name,
      nickname: e.nickname,
      position: e.position,
      photo_url: e.photo_url,
      shifts: byShift,
      evaluated,
      status: !evaluated ? 'NOT_EVALUATED' : anyFail ? 'FAIL' : 'PASS',
    };
  });

  const notEvaluated = rows.filter((r) => !r.evaluated);
  const failed = rows.filter((r) => r.status === 'FAIL');

  return {
    date,
    dateText: thaiDateText(date),
    stationName: config.stationName,
    shifts,
    rows,
    notEvaluated,
    failed,
    totals: {
      inspections: inspections.length,
      pass: inspections.filter((i) => i.result === 'PASS').length,
      fail: inspections.filter((i) => i.result === 'FAIL').length,
      employees: rows.length,
      evaluated: rows.length - notEvaluated.length,
      notEvaluated: notEvaluated.length,
    },
  };
}

module.exports = { buildDailySummary, bangkokDate, isValidDate };
