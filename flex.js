// สร้าง LINE Flex Message (Carousel) สำหรับแจ้งผู้บริหาร
const GREEN = '#06C755';
const GREEN_LIGHT = '#E8F9EE';
const RED = '#E53935';
const RED_LIGHT = '#FDECEA';
const GREY = '#8C8C8C';
const DARK = '#1F1F1F';
const MAX_BUBBLES = 12; // ข้อจำกัดของ LINE carousel

const t = (text, o = {}) => ({
  type: 'text',
  text: String(text === undefined || text === null || text === '' ? '-' : text),
  wrap: true,
  size: 'sm',
  color: DARK,
  ...o,
});

const row = (label, value, color) => ({
  type: 'box',
  layout: 'baseline',
  spacing: 'sm',
  contents: [t(label, { color: GREY, flex: 4 }), t(value, { flex: 6, weight: 'bold', color: color || DARK })],
});

const hero = (url) =>
  url ? { type: 'image', url, size: 'full', aspectRatio: '4:3', aspectMode: 'cover' } : undefined;

const header = (title, subtitle, bg) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: bg,
  paddingAll: '16px',
  contents: [
    t(title, { color: '#FFFFFF', weight: 'bold', size: 'lg' }),
    t(subtitle, { color: '#FFFFFF', size: 'xs', margin: 'sm' }),
  ],
});

const failLine = (label, minus) => ({
  type: 'box',
  layout: 'baseline',
  spacing: 'sm',
  contents: [
    t('✗', { color: RED, flex: 1, weight: 'bold' }),
    t(label, { flex: 7, color: RED }),
    t(`-${minus}`, { flex: 2, color: RED, align: 'end', weight: 'bold' }),
  ],
});

const empDisplayName = (e) => (e.nickname ? `${e.name} (${e.nickname})` : e.name);

function summaryBubble(ctx, hiddenCount) {
  const pass = ctx.result === 'PASS';
  const color = pass ? GREEN : RED;
  const failedEmps = ctx.employees.filter((e) => !e.passed);

  const body = [
    row('สถานี', ctx.stationName),
    row('กะ', ctx.shiftLabel),
    row('วันเวลา', ctx.createdAtText),
    row('ผู้ประเมิน', `${ctx.evaluatorName} (${ctx.roleLabel})`),
    { type: 'separator', margin: 'md' },
    row('พนักงาน', `ผ่าน ${ctx.employees.length - failedEmps.length}/${ctx.employees.length} คน`, failedEmps.length ? RED : GREEN),
    row('พื้นที่', `${ctx.area.score}/100`, ctx.area.passed ? GREEN : RED),
  ];

  if (pass) {
    body.push(
      { type: 'separator', margin: 'md' },
      t('ทุกคนแต่งกายถูกต้อง 100% และพื้นที่ผ่านเกณฑ์ครบทุกข้อ', { color: GREEN, margin: 'md', weight: 'bold' }),
      t(`รายชื่อ: ${ctx.employees.map(empDisplayName).join(', ')}`, { color: GREY, size: 'xs', margin: 'sm' })
    );
  } else {
    body.push({ type: 'separator', margin: 'md' }, t('จุดที่ไม่ผ่าน', { weight: 'bold', color: RED, margin: 'md' }));
    failedEmps.forEach((e) =>
      body.push(t(`• ${empDisplayName(e)}: ${e.failed.map((f) => f.label).join(', ')}`, { size: 'xs', color: RED, margin: 'xs' }))
    );
    if (!ctx.area.passed) {
      body.push(t(`• พื้นที่: ${ctx.area.failed.map((f) => f.label).join(', ')}`, { size: 'xs', color: RED, margin: 'xs' }));
    }
    if (hiddenCount > 0) {
      body.push(t(`(+ อีก ${hiddenCount} รายการ ดูได้ในหน้าแอดมิน)`, { size: 'xxs', color: GREY, margin: 'sm' }));
    }
  }

  return {
    type: 'bubble',
    size: 'mega',
    header: header(pass ? '✅ PASS 100%' : '🚨 FAIL ALERT', pass ? 'กะนี้ผ่านเกณฑ์มาตรฐานครบทุกข้อ' : 'พบรายการไม่ผ่านเกณฑ์มาตรฐาน', color),
    hero: hero(ctx.area.photoUrl),
    body: { type: 'box', layout: 'vertical', spacing: 'sm', backgroundColor: pass ? GREEN_LIGHT : '#FFFFFF', contents: body },
  };
}

function employeeFailBubble(e) {
  const photo = e.evidenceUrl || e.profileUrl;
  return {
    type: 'bubble',
    size: 'mega',
    header: header(`❌ ${empDisplayName(e)}`, `${e.position || 'พนักงาน'} • คะแนน ${e.score}/100`, RED),
    hero: hero(photo),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        t(e.evidenceUrl ? '📷 รูปหลักฐานจุดที่ผิด' : '👤 รูปประจำตัว (ไม่มีรูปหลักฐาน)', { size: 'xs', color: GREY }),
        t('รายการที่ไม่ผ่าน', { weight: 'bold', color: RED, margin: 'md' }),
        ...e.failed.map((f) => failLine(f.label, f.max)),
      ],
      backgroundColor: RED_LIGHT,
    },
  };
}

function areaFailBubble(area) {
  return {
    type: 'bubble',
    size: 'mega',
    header: header('❌ พื้นที่ไม่ผ่านเกณฑ์', `คะแนน ${area.score}/100`, RED),
    hero: hero(area.photoUrl),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      backgroundColor: RED_LIGHT,
      contents: [
        t('📷 รูปหลักฐานพื้นที่', { size: 'xs', color: GREY }),
        t('รายการที่ไม่ผ่าน', { weight: 'bold', color: RED, margin: 'md' }),
        ...area.failed.map((f) => failLine(f.label, f.max)),
      ],
    },
  };
}

function employeePassBubble(e) {
  return {
    type: 'bubble',
    size: 'mega',
    header: header(`✅ ${empDisplayName(e)}`, `${e.position || 'พนักงาน'} • 100/100`, GREEN),
    hero: hero(e.evidenceUrl || e.profileUrl),
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: GREEN_LIGHT,
      contents: [t('แต่งกายถูกต้องครบ 6 รายการ', { color: GREEN, weight: 'bold' })],
    },
  };
}

const clean = (b) => {
  if (!b.hero) delete b.hero;
  return b;
};

/**
 * @param ctx {{result, stationName, shiftLabel, roleLabel, evaluatorName, createdAtText,
 *   employees:[{name,nickname,position,profileUrl,evidenceUrl,score,passed,failed}],
 *   area:{score,passed,failed,photoUrl}}}
 */
function buildInspectionFlex(ctx) {
  const detail = [];
  if (ctx.result === 'FAIL') {
    if (!ctx.area.passed) detail.push(areaFailBubble(ctx.area));
    ctx.employees.filter((e) => !e.passed).forEach((e) => detail.push(employeeFailBubble(e)));
  } else {
    // PASS: แสดงรูปหลักฐานรายคน (ถ้าแนบมา)
    ctx.employees.filter((e) => e.evidenceUrl).forEach((e) => detail.push(employeePassBubble(e)));
  }

  const room = MAX_BUBBLES - 1;
  const shown = detail.slice(0, room);
  const hidden = ctx.result === 'FAIL' ? detail.length - shown.length : 0;
  const bubbles = [summaryBubble(ctx, hidden), ...shown].map(clean);

  const failedCount = ctx.employees.filter((e) => !e.passed).length;
  const altText =
    ctx.result === 'PASS'
      ? `✅ PASS ${ctx.shiftLabel} ${ctx.stationName} ผ่านเกณฑ์ 100%`
      : `🚨 FAIL ${ctx.shiftLabel} ${ctx.stationName} พนักงานไม่ผ่าน ${failedCount} คน${ctx.area.passed ? '' : ' / พื้นที่ไม่ผ่าน'}`;

  return {
    type: 'flex',
    altText: altText.slice(0, 400),
    contents: bubbles.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles },
  };
}

// ================= Daily Summary =================
const AMBER = '#F59E0B';
const MAX_ROWS = 25; // จำกัดแถวต่อ bubble ไม่ให้ Flex ยาวเกิน

const cell = (text, o = {}) => t(text, { size: 'xs', flex: 1, align: 'center', ...o });

const tableRow = (cells, bg) => ({
  type: 'box',
  layout: 'horizontal',
  spacing: 'xs',
  paddingAll: '6px',
  cornerRadius: '4px',
  ...(bg ? { backgroundColor: bg } : {}),
  contents: cells,
});

const shiftMark = (r) => (!r ? '—' : r.passed ? '✅' : '❌');

function dailyFlex(s) {
  const shiftTable = [
    tableRow(
      [cell('กะ', { weight: 'bold', align: 'start', flex: 2 }), cell('สถานะ', { weight: 'bold', flex: 3 }), cell('PASS', { weight: 'bold', flex: 2 }), cell('FAIL', { weight: 'bold', flex: 2 })],
      '#F2F2F2'
    ),
    ...s.shifts.map((sh) =>
      tableRow([
        cell(sh.label, { align: 'start', flex: 2 }),
        cell(sh.submitted ? `ส่งแล้ว ${sh.lastAt}` : '⏳ ยังไม่ส่ง', { flex: 3, color: sh.submitted ? DARK : AMBER, weight: sh.submitted ? 'regular' : 'bold' }),
        cell(String(sh.pass), { flex: 2, color: GREEN, weight: 'bold' }),
        cell(String(sh.fail), { flex: 2, color: sh.fail ? RED : GREY, weight: 'bold' }),
      ])
    ),
  ];

  const allDone = s.notEvaluated.length === 0 && s.shifts.every((x) => x.submitted);
  const headerColor = s.totals.fail || s.notEvaluated.length ? (s.totals.fail ? RED : AMBER) : GREEN;

  const summary = {
    type: 'bubble',
    size: 'mega',
    header: header('📊 สรุปผลประเมินรายวัน', `${s.stationName} • ${s.dateText}`, headerColor),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        ...shiftTable,
        { type: 'separator', margin: 'md' },
        row('ประเมินแล้ว', `${s.totals.evaluated}/${s.totals.employees} คน`, s.totals.notEvaluated ? AMBER : GREEN),
        row('ยังไม่ได้ประเมิน', `${s.totals.notEvaluated} คน`, s.totals.notEvaluated ? AMBER : GREEN),
        row('พนักงานไม่ผ่าน', `${s.failed.length} คน`, s.failed.length ? RED : GREEN),
        ...(allDone && !s.totals.fail ? [t('🎉 ทุกกะส่งครบ และผ่านเกณฑ์ 100%', { color: GREEN, weight: 'bold', margin: 'md' })] : []),
      ],
    },
  };

  const bubbles = [summary];

  // ตารางคนที่ยังไม่ได้ประเมิน
  if (s.notEvaluated.length) {
    const list = s.notEvaluated.slice(0, MAX_ROWS);
    bubbles.push({
      type: 'bubble',
      size: 'mega',
      header: header(`⏳ ยังไม่ได้ประเมิน (${s.notEvaluated.length} คน)`, s.dateText, AMBER),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        contents: [
          tableRow([cell('#', { weight: 'bold', flex: 1 }), cell('ชื่อ', { weight: 'bold', align: 'start', flex: 6 }), cell('ตำแหน่ง', { weight: 'bold', align: 'start', flex: 4 })], '#FEF3C7'),
          ...list.map((e, i) =>
            tableRow([
              cell(String(i + 1), { flex: 1, color: GREY }),
              cell(e.nickname ? `${e.name} (${e.nickname})` : e.name, { align: 'start', flex: 6 }),
              cell(e.position || '-', { align: 'start', flex: 4, color: GREY }),
            ], i % 2 ? '#FFFBEB' : undefined)
          ),
          ...(s.notEvaluated.length > list.length ? [t(`+ อีก ${s.notEvaluated.length - list.length} คน (ดูในหน้าแอดมิน)`, { size: 'xxs', color: GREY, margin: 'sm' })] : []),
        ],
      },
    });
  }

  // ตารางคนที่ไม่ผ่าน (แยกตามกะ)
  if (s.failed.length) {
    const list = s.failed.slice(0, MAX_ROWS);
    bubbles.push({
      type: 'bubble',
      size: 'mega',
      header: header(`❌ พนักงานไม่ผ่าน (${s.failed.length} คน)`, 'เช้า / บ่าย / ดึก', RED),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        contents: [
          tableRow([cell('ชื่อ', { weight: 'bold', align: 'start', flex: 5 }), cell('เช้า', { weight: 'bold', flex: 2 }), cell('บ่าย', { weight: 'bold', flex: 2 }), cell('ดึก', { weight: 'bold', flex: 2 })], RED_LIGHT),
          ...list.flatMap((e) => {
            const reasons = [...new Set(Object.values(e.shifts).flatMap((r) => r.failed))];
            return [
              tableRow([
                cell(e.nickname || e.name, { align: 'start', flex: 5 }),
                cell(shiftMark(e.shifts.morning), { flex: 2 }),
                cell(shiftMark(e.shifts.afternoon), { flex: 2 }),
                cell(shiftMark(e.shifts.night), { flex: 2 }),
              ]),
              t(`   ไม่ผ่าน: ${reasons.join(', ')}`, { size: 'xxs', color: RED }),
            ];
          }),
        ],
      },
    });
  }

  // ถ้าทุกกะยังไม่ส่ง ไม่ต้องใช้สีอื่น
  if (!s.totals.inspections) summary.header = header('📊 สรุปผลประเมินรายวัน', `${s.stationName} • ${s.dateText} • ยังไม่มีการประเมิน`, AMBER);

  const altText = `📊 สรุป ${s.dateText}: ประเมินแล้ว ${s.totals.evaluated}/${s.totals.employees} คน, ยังไม่ประเมิน ${s.totals.notEvaluated} คน, ไม่ผ่าน ${s.failed.length} คน`;
  return {
    type: 'flex',
    altText: altText.slice(0, 400),
    contents: bubbles.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles },
  };
}

module.exports = { buildInspectionFlex, buildDailySummaryFlex: dailyFlex };
