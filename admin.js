const { esc, compressImage, toast, avatar } = window.Common;
const $ = (s) => document.querySelector(s);
const SHIFT = { morning: 'กะเช้า', afternoon: 'กะบ่าย', night: 'กะดึก' };
const ROLE = { shift_manager: 'ผู้จัดการกะ', captain: 'กัปตัน', cashier: 'แคชเชียร์' };

let KEY = '';
try { KEY = sessionStorage.getItem('adminKey') || ''; } catch {}
let employees = [];
let editing = null;
let addBlob = null;
let editBlob = null;

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), 'x-admin-key': KEY } });
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401) { logout(); throw new Error(data.error || 'รหัสไม่ถูกต้อง'); }
  if (!res.ok) throw new Error(data.error || `ผิดพลาด ${res.status}`);
  return data;
}

function logout() {
  KEY = '';
  try { sessionStorage.removeItem('adminKey'); } catch {}
  $('#main').classList.add('hidden');
  $('#logoutBtn').classList.add('hidden');
  $('#login').classList.remove('hidden');
}

async function login() {
  try {
    await loadEmployees();
    try { sessionStorage.setItem('adminKey', KEY); } catch {}
    $('#login').classList.add('hidden');
    $('#main').classList.remove('hidden');
    $('#logoutBtn').classList.remove('hidden');
    showTab('employees');
  } catch (e) { toast(e.message); }
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach((b) => {
    b.className = `tab px-4 py-2 rounded-lg font-semibold ${b.dataset.tab === name ? 'bg-[#06C755] text-white' : 'bg-white'}`;
  });
  ['employees', 'daily', 'history'].forEach((t) => $(`#tab-${t}`).classList.toggle('hidden', name !== t));
  if (name === 'history') loadHistory();
  if (name === 'daily') loadDaily();
}

// ---------- Daily summary ----------
const todayBkk = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
const shiftDate = (d, n) => {
  const x = new Date(`${d}T12:00:00+07:00`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
};
let daily = null;

async function loadDaily() {
  const input = $('#dailyDate');
  if (!input.value) input.value = todayBkk();
  $('#dailyRows').innerHTML = '<tr><td colspan="5" class="p-4 text-gray-500">กำลังโหลด...</td></tr>';
  try {
    daily = await api(`/api/admin/daily-summary?date=${input.value}`);
    renderDaily();
  } catch (e) {
    $('#dailyRows').innerHTML = `<tr><td colspan="5" class="p-4 text-red-500">${esc(e.message)}</td></tr>`;
  }
}

function renderDaily() {
  const s = daily;
  const card = (label, value, color) => `
    <div class="bg-white rounded-2xl shadow-sm p-4">
      <p class="text-xs text-gray-500">${label}</p>
      <p class="text-2xl font-bold ${color}">${value}</p>
    </div>`;
  $('#dailyCards').innerHTML =
    card('ประเมินแล้ว', `${s.totals.evaluated}/${s.totals.employees}`, 'text-gray-900') +
    card('ยังไม่ได้ประเมิน', s.totals.notEvaluated, s.totals.notEvaluated ? 'text-amber-500' : 'text-green-600') +
    card('รอบที่ PASS', s.totals.pass, 'text-green-600') +
    card('รอบที่ FAIL', s.totals.fail, s.totals.fail ? 'text-red-600' : 'text-gray-400');

  $('#dailyShifts').innerHTML = s.shifts.map((sh) => `
    <div class="bg-white rounded-2xl shadow-sm p-4 border-l-4 ${!sh.submitted ? 'border-amber-400' : sh.fail ? 'border-red-500' : 'border-[#06C755]'}">
      <div class="flex justify-between items-center">
        <p class="font-bold">${sh.label}</p>
        <span class="text-xs px-2 py-1 rounded-full ${sh.submitted ? 'bg-gray-100' : 'bg-amber-100 text-amber-700 font-semibold'}">${sh.submitted ? `ส่งแล้ว ${sh.count} รอบ • ${sh.lastAt}` : '⏳ ยังไม่ส่ง'}</span>
      </div>
      ${sh.submitted ? `<p class="text-sm mt-2"><span class="text-green-600 font-semibold">PASS ${sh.pass}</span> • <span class="${sh.fail ? 'text-red-600' : 'text-gray-400'} font-semibold">FAIL ${sh.fail}</span></p>
      <p class="text-xs text-gray-500 mt-1">ผู้ประเมิน: ${esc(sh.evaluators.join(', ') || '-')}</p>` : ''}
    </div>`).join('');

  const shiftCell = (r) =>
    !r
      ? '<td class="p-3 text-center text-gray-300">—</td>'
      : `<td class="p-3 text-center"><span class="inline-block px-2 py-1 rounded-lg text-xs font-bold ${r.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}" title="${esc(r.failed.join(', '))}">${r.passed ? '✓' : '✗'} ${r.score}</span><div class="text-[10px] text-gray-400">${r.time}</div></td>`;
  const badge = {
    NOT_EVALUATED: '<span class="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">⏳ ยังไม่ได้ประเมิน</span>',
    PASS: '<span class="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">PASS</span>',
    FAIL: '<span class="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">FAIL</span>',
  };
  // คนที่ยังไม่ได้ประเมินขึ้นก่อน ตามด้วย FAIL แล้ว PASS
  const order = { NOT_EVALUATED: 0, FAIL: 1, PASS: 2 };
  const rows = s.rows
    .filter((r) => !$('#onlyPending').checked || !r.evaluated)
    .sort((a, b) => order[a.status] - order[b.status]);

  $('#dailyRows').innerHTML = rows.length
    ? rows.map((r) => `
      <tr class="border-t ${r.evaluated ? '' : 'bg-amber-50/60'}">
        <td class="p-3">
          <div class="flex items-center gap-3">
            ${avatar(r.photo_url, r.name, 'w-10 h-10')}
            <div><p class="font-semibold">${esc(r.name)} ${r.nickname ? `<span class="text-gray-500 font-normal">(${esc(r.nickname)})</span>` : ''}</p>
            <p class="text-xs text-gray-500">${esc(r.position || '-')}</p></div>
          </div>
        </td>
        ${shiftCell(r.shifts.morning)}${shiftCell(r.shifts.afternoon)}${shiftCell(r.shifts.night)}
        <td class="p-3 text-center">${badge[r.status]}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="p-4 text-center text-green-600 font-semibold">🎉 ทุกคนได้รับการประเมินแล้ว</td></tr>';
}

function downloadCsv() {
  if (!daily) return;
  const label = { NOT_EVALUATED: 'ยังไม่ได้ประเมิน', PASS: 'PASS', FAIL: 'FAIL' };
  const cellText = (r) => (!r ? '' : `${r.passed ? 'ผ่าน' : 'ไม่ผ่าน'} ${r.score}${r.failed.length ? ` (${r.failed.join('/')})` : ''}`);
  const lines = [['วันที่', 'ชื่อ', 'ชื่อเล่น', 'ตำแหน่ง', 'กะเช้า', 'กะบ่าย', 'กะดึก', 'สถานะ']].concat(
    daily.rows.map((r) => [daily.date, r.name, r.nickname || '', r.position || '', cellText(r.shifts.morning), cellText(r.shifts.afternoon), cellText(r.shifts.night), label[r.status]])
  );
  const csv = '﻿' + lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `daily-summary-${daily.date}.csv`;
  a.click();
}

$('#dailyDate').addEventListener('change', loadDaily);
$('#dayPrev').onclick = () => { $('#dailyDate').value = shiftDate($('#dailyDate').value || todayBkk(), -1); loadDaily(); };
$('#dayNext').onclick = () => { $('#dailyDate').value = shiftDate($('#dailyDate').value || todayBkk(), 1); loadDaily(); };
$('#onlyPending').addEventListener('change', () => daily && renderDaily());
$('#dailyCsv').onclick = downloadCsv;
$('#dailySend').onclick = async () => {
  try {
    const r = await api('/api/admin/daily-summary/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: $('#dailyDate').value || todayBkk() }),
    });
    toast(r.status === 'sent' ? 'ส่งสรุปเข้า LINE แล้ว' : `ส่งไม่สำเร็จ: ${r.error}`, r.status === 'sent' ? 'ok' : 'error');
  } catch (e) { toast(e.message); }
};

// ---------- Employees ----------
async function loadEmployees() {
  const data = await api('/api/admin/employees');
  employees = data.employees;
  renderEmployees();
}

function renderEmployees() {
  $('#empList').innerHTML = employees.length
    ? employees.map((e) => `
      <div class="bg-white rounded-2xl shadow-sm p-3 flex items-center gap-3 ${e.active ? '' : 'opacity-50'}">
        ${avatar(e.photo_url, e.name, 'w-16 h-16')}
        <div class="flex-1 min-w-0">
          <p class="font-bold truncate">${esc(e.name)} ${e.nickname ? `<span class="text-gray-500 font-normal">(${esc(e.nickname)})</span>` : ''}</p>
          <p class="text-xs text-gray-500">${esc(e.position || '-')} ${e.active ? '' : '• <span class="text-red-500">ปิดใช้งาน</span>'}</p>
          ${e.photo_url ? '' : '<p class="text-xs text-amber-600">⚠ ยังไม่มีรูป</p>'}
        </div>
        <button onclick="openEdit('${e.id}')" class="px-3 py-1.5 rounded-lg bg-gray-100 text-sm font-semibold">แก้ไข</button>
      </div>`).join('')
    : '<p class="text-gray-500">ยังไม่มีพนักงาน เพิ่มด้านบนได้เลย</p>';
}

$('#addPhoto').addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  try {
    addBlob = await compressImage(f, 800, 0.8);
    $('#addPreview').innerHTML = `<img src="${URL.createObjectURL(addBlob)}" class="w-full h-full object-cover">`;
  } catch (e) { toast(e.message); }
});

$('#addForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  if (addBlob) fd.append('photo', addBlob, 'photo.jpg');
  const btn = form.querySelector('button');
  btn.disabled = true;
  try {
    await api('/api/admin/employees', { method: 'POST', body: fd });
    form.reset();
    addBlob = null;
    $('#addPreview').innerHTML = '📷';
    toast('เพิ่มพนักงานแล้ว', 'ok');
    await loadEmployees();
  } catch (e) { toast(e.message); } finally { btn.disabled = false; }
});

window.openEdit = (id) => {
  editing = employees.find((e) => e.id === id);
  editBlob = null;
  const f = $('#editForm');
  f.elements.name.value = editing.name || '';
  f.elements.nickname.value = editing.nickname || '';
  f.elements.position.value = editing.position || '';
  f.elements.active.checked = !!editing.active;
  $('#editPreview').innerHTML = editing.photo_url ? `<img src="${esc(editing.photo_url)}" class="w-full h-full object-cover">` : '📷';
  $('#modal').classList.remove('hidden');
};

$('#editPhoto').addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  try {
    editBlob = await compressImage(f, 800, 0.8);
    $('#editPreview').innerHTML = `<img src="${URL.createObjectURL(editBlob)}" class="w-full h-full object-cover">`;
  } catch (e) { toast(e.message); }
});

$('#cancelEdit').onclick = () => $('#modal').classList.add('hidden');

$('#editForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const fd = new FormData();
  fd.append('name', f.elements.name.value);
  fd.append('nickname', f.elements.nickname.value);
  fd.append('position', f.elements.position.value);
  fd.append('active', f.elements.active.checked ? 'true' : 'false');
  if (editBlob) fd.append('photo', editBlob, 'photo.jpg');
  try {
    await api(`/api/admin/employees/${editing.id}`, { method: 'PUT', body: fd });
    $('#modal').classList.add('hidden');
    toast('บันทึกแล้ว', 'ok');
    await loadEmployees();
  } catch (e) { toast(e.message); }
});

// ---------- History ----------
async function loadHistory() {
  const box = $('#tab-history');
  box.innerHTML = '<p class="text-gray-500">กำลังโหลด...</p>';
  try {
    const { inspections } = await api('/api/admin/inspections?limit=50');
    box.innerHTML = inspections.length ? inspections.map(renderInspection).join('') : '<p class="text-gray-500">ยังไม่มีข้อมูล</p>';
  } catch (e) { box.innerHTML = `<p class="text-red-500">${esc(e.message)}</p>`; }
}

function renderInspection(i) {
  const pass = i.result === 'PASS';
  const when = new Date(i.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
  const areaFailed = (i.area_items || []).filter((x) => !x.passed).map((x) => x.label);
  return `
    <details class="bg-white rounded-2xl shadow-sm overflow-hidden">
      <summary class="p-4 cursor-pointer flex items-center gap-3">
        <span class="px-3 py-1 rounded-full text-white text-sm font-bold ${pass ? 'bg-[#06C755]' : 'bg-red-500'}">${i.result}</span>
        <span class="font-semibold">${SHIFT[i.shift] || i.shift}</span>
        <span class="text-sm text-gray-500">${when}</span>
        <span class="ml-auto text-xs text-gray-400">${esc(i.evaluator_name || '-')} (${ROLE[i.evaluator_role] || ''}) • แจ้งเตือน: ${esc(i.notify_status || '-')}</span>
      </summary>
      <div class="px-4 pb-4 grid md:grid-cols-[200px_1fr] gap-4">
        <div>
          ${i.area_photo_url ? `<a href="${esc(i.area_photo_url)}" target="_blank"><img src="${esc(i.area_photo_url)}" class="w-full rounded-xl"></a>` : ''}
          <p class="text-sm mt-2">พื้นที่: <b class="${i.area_score === 100 ? 'text-green-600' : 'text-red-600'}">${i.area_score}/100</b></p>
          ${areaFailed.length ? `<p class="text-xs text-red-600">ไม่ผ่าน: ${esc(areaFailed.join(', '))}</p>` : ''}
        </div>
        <div class="space-y-2">
          ${(i.inspection_employees || []).map((e) => `
            <div class="flex items-center gap-3 p-2 rounded-xl ${e.passed ? 'bg-green-50' : 'bg-red-50'}">
              ${e.photo_url ? `<a href="${esc(e.photo_url)}" target="_blank"><img src="${esc(e.photo_url)}" class="w-12 h-12 rounded-lg object-cover"></a>` : ''}
              <div>
                <p class="font-semibold text-sm">${esc(e.employee_name)} • <span class="${e.passed ? 'text-green-600' : 'text-red-600'}">${e.score}/100</span></p>
                ${e.passed ? '' : `<p class="text-xs text-red-600">ไม่ผ่าน: ${esc((e.items || []).filter((x) => !x.passed).map((x) => x.label).join(', '))}</p>`}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </details>`;
}

// ---------- Wire up ----------
$('#loginBtn').onclick = () => { KEY = $('#keyInput').value.trim(); login(); };
$('#keyInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#loginBtn').click(); });
$('#logoutBtn').onclick = logout;
document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
$('#testNotify').onclick = async () => {
  try {
    const r = await api('/api/admin/test-notify', { method: 'POST' });
    toast(r.status === 'sent' ? 'ส่งแจ้งเตือนทดสอบแล้ว' : `ส่งไม่สำเร็จ: ${r.error}`, r.status === 'sent' ? 'ok' : 'error');
  } catch (e) { toast(e.message); }
};

if (KEY) login();
