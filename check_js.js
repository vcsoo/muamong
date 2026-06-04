
let employees = [];
let selectedEmpId = null;
let salesData = null;
let editingId = null;
let allDetails = [];

const now = new Date();
document.getElementById('sel-year').value  = now.getFullYear();
document.getElementById('sel-month').value = now.getMonth() + 1;

// ── 직원 로드 ───────────────────────────────────────────────────────────────
async function loadEmployees() {
  const r = await fetch('/employees');
  employees = await r.json();
  renderEmpGrid();
  renderEmpSelector();
}

async function renderEmpGrid() {
  const g = document.getElementById('emp-grid');
  if (!employees.length) {
    g.innerHTML = '<p style="color:#aaa;padding:20px">등록된 직원이 없습니다</p>'; return;
  }
  const recordsArr = await Promise.all(employees.map(e =>
    fetch(`/salary/${e.id}`).then(r=>r.json())));

  g.innerHTML = employees.map((e, idx) => {
    const recs = recordsArr[idx];
    const keys = Object.keys(recs).sort().reverse();
    // 3번: 줄바뀜 없이 한 줄 + 수정/삭제 버튼
    const miniRows = keys.slice(0, 6).map(k => {
      const rec = recs[k];
      return `<div class="salary-row">
        <span class="sr-period">${rec.year}년 ${rec.month}월</span>
        <span class="sr-total">매출 ${fmt(rec.service_total + rec.product_total)}</span>
        <span class="sr-net snet">${fmt(rec.payroll.net)}원</span>
        <span class="sr-btns">
          <span class="sedit" onclick="loadSavedRecord('${e.id}','${rec.year}','${rec.month}')" title="수정">✏️</span>
          <span class="sdel"  onclick="deleteSalary('${e.id}','${rec.year}','${rec.month}')"    title="삭제">✕</span>
        </span>
      </div>`;
    }).join('');

    return `<div class="emp-card">
      <div class="emp-name">${e.name}</div>
      <div class="emp-meta">${e.salon||''} · ${e.role||''}</div>
      <div class="rate-badges">
        <span class="badge badge-s">시술 ${e.commission_rate}%</span>
        <span class="badge badge-p">점판 ${e.product_commission_rate||50}%</span>
      </div>
      <div class="emp-actions">
        <button class="btn-sm btn-edit" onclick="openModal('${e.id}')">수정</button>
        <button class="btn-sm btn-del"  onclick="deleteEmployee('${e.id}')">삭제</button>
      </div>
      ${keys.length ? `<div class="salary-mini">
        <div class="salary-mini-title">📅 월별 급여 기록 (${keys.length}건)</div>
        <div class="salary-mini-rows">${miniRows}</div>
      </div>` : '<div style="font-size:.75rem;color:#bbb;margin-top:8px">저장된 급여 기록 없음</div>'}
    </div>`;
  }).join('');
}

function renderEmpSelector() {
  const s = document.getElementById('emp-selector');
  if (!employees.length) {
    s.innerHTML = '<p style="color:#aaa;font-size:.82rem">직원 관리 탭에서 추가하세요</p>'; return;
  }
  s.innerHTML = employees.map(e => `
    <div class="emp-sel-item ${selectedEmpId===e.id?'active':''}" onclick="selectEmp('${e.id}')">
      <div class="sname">${e.name}</div>
      <div class="srate">시술 ${e.commission_rate}% / 점판 ${e.product_commission_rate||50}%</div>
    </div>
  `).join('');
}

function selectEmp(id) {
  // 다른 직원으로 바꿀 때 기존 데이터 초기화
  if (selectedEmpId && selectedEmpId !== id) {
    salesData = null;
    allDetails = [];

    // 업로드 존 초기화
    const zone = document.getElementById('upload-zone');
    zone.innerHTML = `<div class="icon">📂</div>
      <p>POS 매출 엑셀(.xls) 파일을 클릭하거나 드래그</p>
      <div class="hint">파일명: 이름_N월.xls → 직원·기간 자동 인식</div>
      <input type="file" id="file-input" accept=".xls,.xlsx" style="display:none"
             onchange="uploadFile(this.files[0])">`;

    // 요약/계산 영역 숨김
    document.getElementById('sales-summary').style.display = 'none';
    document.getElementById('detect-banner').classList.remove('show');

    // 점판/구매 테이블 초기화
    document.getElementById('product-tbody').innerHTML =
      '<tr><td colspan="3" style="color:#bbb;text-align:center;padding:10px">점판 항목 없음 — 추가 버튼으로 직접 입력</td></tr>';
    document.getElementById('purchase-tbody').innerHTML =
      '<tr><td colspan="3" style="color:#bbb;text-align:center;padding:10px">차감 항목 없음 — 추가 버튼으로 입력</td></tr>';
    document.getElementById('pt-total').textContent = '0원';
    document.getElementById('pur-total').textContent = '0원';

    // 내역 탭 초기화
    document.getElementById('detail-area').innerHTML =
      '<p style="color:#aaa;text-align:center;padding:40px">급여 계산 탭에서 파일을 업로드하면 표시됩니다</p>';
  }

  selectedEmpId = id;
  renderEmpSelector();
  renderCalc();
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  btn.classList.add('active');
  if (name === 'employees') renderEmpGrid();
  if (name === 'history')   renderHistoryEmpCheckboxes();
}

// ── 파일 업로드 ─────────────────────────────────────────────────────────────
async function uploadFile(file) {
  if (!file) return;
  const zone = document.getElementById('upload-zone');
  zone.innerHTML = '<div class="icon">⏳</div><p>분석 중...</p>';

  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/upload', { method:'POST', body:fd });
  const data = await r.json();

  zone.innerHTML = `<div class="icon">✅</div><p>${file.name}</p><div class="hint">다른 파일로 바꾸려면 클릭</div>
    <input type="file" id="file-input" accept=".xls,.xlsx" style="display:none"
     onchange="uploadFile(this.files[0])">`;

  if (data.error) { showToast('파싱 오류: ' + data.error); return; }
  salesData = data;

  // 자동 인식
  let detected = [];
  if (data.emp_name) {
    const matched = employees.find(e => e.name === data.emp_name);
    if (matched) { selectedEmpId = matched.id; renderEmpSelector(); detected.push('직원: '+data.emp_name); }
  }
  if (data.month > 0) {
    document.getElementById('sel-month').value = data.month;
    document.getElementById('sel-year').value  = data.year;
    detected.push(`기간: ${data.year}년 ${data.month}월`);
  }
  if (detected.length) {
    document.getElementById('detect-text').textContent = '자동 인식 → ' + detected.join(' / ');
    document.getElementById('detect-banner').classList.add('show');
  }

  // 시술 요약
  document.getElementById('s-service-total').textContent = fmt(data.service_total)+'원';
  document.getElementById('s-scnt').textContent  = (data.service_count||0)+'건';
  document.getElementById('s-scash').textContent = fmt(data.service_cash);
  document.getElementById('s-scard').textContent = fmt(data.service_card);
  document.getElementById('s-spay').textContent  = fmt(data.service_pay);
  document.getElementById('s-product-total').textContent = data.product_total>0 ? fmt(data.product_total)+'원' : '없음';
  document.getElementById('s-pcnt').textContent  = (data.product_count||0)+'건';
  document.getElementById('s-pcash').textContent = fmt(data.product_cash);
  document.getElementById('s-pcard').textContent = fmt(data.product_card);
  document.getElementById('s-ppay').textContent  = fmt(data.product_pay);

  // 점판 편집 테이블 초기화
  const productItems = data.details.filter(d => d.category === 'product');
  initProductTable(productItems.length ? productItems : (data.product_total > 0 ? [{menu:'점판',amount:data.product_total}] : []));

  // 직원 구매 테이블 초기화 (새 파일 로드 시 비움)
  const purTbody = document.getElementById('purchase-tbody');
  purTbody.innerHTML = '<tr><td colspan="3" style="color:#bbb;text-align:center;padding:10px">차감 항목 없음 — 추가 버튼으로 입력</td></tr>';
  document.getElementById('pur-total').textContent = '0원';

  document.getElementById('sales-summary').style.display = 'block';
  renderCalc();
  renderDetailTable(data.details);
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag');
  uploadFile(e.dataTransfer.files[0]);
}

// ── 점판 편집 테이블 ────────────────────────────────────────────────────────
function initProductTable(items) {
  const tbody = document.getElementById('product-tbody');
  tbody.innerHTML = '';
  if (items.length === 0) {
    // 점판 없으면 빈 안내
    tbody.innerHTML = '<tr><td colspan="3" style="color:#bbb;text-align:center;padding:10px">점판 항목 없음 — 추가 버튼으로 직접 입력</td></tr>';
  } else {
    items.forEach(item => addProductRow(item.menu || item.name, item.amount));
  }
  updateProductTotal();
}

function addProductRow(name='', amount=0) {
  const tbody = document.getElementById('product-tbody');
  // "없음" 안내 행 제거
  const emptyRow = tbody.querySelector('td[colspan]');
  if (emptyRow) emptyRow.parentElement.remove();

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" value="${name}" placeholder="항목명" oninput="updateProductTotal()"></td>
    <td><input type="number" value="${amount}" placeholder="0" min="0" oninput="updateProductTotal()"></td>
    <td class="td-del"><button class="btn-del-row" onclick="removeProductRow(this)">✕</button></td>
  `;
  tbody.appendChild(tr);
  updateProductTotal();
}

function removeProductRow(btn) {
  btn.closest('tr').remove();
  const tbody = document.getElementById('product-tbody');
  if (!tbody.querySelector('input')) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:#bbb;text-align:center;padding:10px">점판 항목 없음 — 추가 버튼으로 직접 입력</td></tr>';
  }
  updateProductTotal();
}

function getProductItems() {
  const rows = document.querySelectorAll('#product-tbody tr');
  const items = [];
  rows.forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (inputs.length === 2) {
      const name   = inputs[0].value.trim() || '점판';
      const amount = parseInt(inputs[1].value) || 0;
      if (amount > 0) items.push({ name, amount });
    }
  });
  return items;
}

function updateProductTotal() {
  const items = getProductItems();
  const total = items.reduce((s, i) => s + i.amount, 0);
  document.getElementById('pt-total').textContent = fmt(total) + '원';
  document.getElementById('s-product-total').textContent = total > 0 ? fmt(total)+'원' : '없음';
  renderCalc();
}

// ── 직원 구매 차감 ───────────────────────────────────────────────────────────
function addPurchaseRow(name='', amount=0) {
  const tbody = document.getElementById('purchase-tbody');
  const emptyRow = tbody.querySelector('td[colspan]');
  if (emptyRow) emptyRow.parentElement.remove();

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" value="${name}" placeholder="구매 항목명" oninput="updatePurchaseTotal()"></td>
    <td><input type="number" value="${amount||''}" placeholder="0" min="0" oninput="updatePurchaseTotal()"></td>
    <td style="text-align:center;width:30px"><button class="btn-del-row" onclick="removePurchaseRow(this)">✕</button></td>
  `;
  tbody.appendChild(tr);
  updatePurchaseTotal();
}

function removePurchaseRow(btn) {
  btn.closest('tr').remove();
  const tbody = document.getElementById('purchase-tbody');
  if (!tbody.querySelector('input')) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:#bbb;text-align:center;padding:10px">차감 항목 없음 — 추가 버튼으로 입력</td></tr>';
  }
  updatePurchaseTotal();
}

function getPurchaseItems() {
  const rows = document.querySelectorAll('#purchase-tbody tr');
  const items = [];
  rows.forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (inputs.length === 2) {
      const name   = inputs[0].value.trim() || '구매';
      const amount = parseInt(inputs[1].value) || 0;
      if (amount > 0) items.push({ name, amount });
    }
  });
  return items;
}

function updatePurchaseTotal() {
  const items  = getPurchaseItems();
  const total  = items.reduce((s, i) => s + i.amount, 0);
  document.getElementById('pur-total').textContent = total > 0 ? '- ' + fmt(total) + '원' : '0원';
  renderCalc();
}

// ── 급여 계산 표시 ──────────────────────────────────────────────────────────
function renderCalc() {
  const box = document.getElementById('calc-box');
  const canAct = salesData && selectedEmpId;
  document.getElementById('save-btn').disabled = !canAct;
  document.getElementById('dl-btn').disabled   = !canAct;

  if (!canAct) {
    box.innerHTML = '<p style="color:#aaa;text-align:center">직원을 선택하면 급여가 계산됩니다</p>';
    return;
  }
  const emp   = employees.find(e => e.id === selectedEmpId);
  if (!emp) return;

  const sRate    = emp.commission_rate;
  const pRate    = emp.product_commission_rate || 50;
  const sTotal   = salesData.service_total || 0;
  const pItems   = getProductItems();
  const purItems = getPurchaseItems();
  const pTotal   = pItems.reduce((s, i) => s + i.amount, 0);
  const purTotal = purItems.reduce((s, i) => s + i.amount, 0);
  const sGross   = Math.floor(sTotal * sRate / 100);
  // 점판: 판매가 - 부가세(10%) - 원가(50%) = 이익(40%) → × 수수료율
  const pProfit  = Math.floor(pTotal * 0.4);
  const pGross   = Math.floor(pProfit * pRate / 100);
  const gross    = sGross + pGross;
  // 차감항목을 급여합계에서 먼저 빼고 → 그 금액에 3.3% 세금 부과
  const taxable  = gross - purTotal;
  const it       = Math.floor(taxable * 0.03);
  const lt       = Math.floor(taxable * 0.003);
  const ded      = it + lt;
  const net      = taxable - ded;

  box.innerHTML = `
    <div class="calc-row">
      <span class="lbl">시술 매출 <span class="tag-s">수수료 ${sRate}%</span></span>
      <span class="val">${fmt(sTotal)} × ${sRate}% = ${fmt(sGross)}원</span>
    </div>
    <div class="calc-row">
      <span class="lbl">점판 매출 <span class="tag-p">부가세10%-원가50%-수수료율 ${pRate}%</span></span>
      <span class="val">${pTotal>0
        ? fmt(pTotal)+' → '+fmt(pGross)+'원'
        : '해당없음'}</span>
    </div>
    ${pTotal>0 ? `
    <div class="calc-row" style="font-size:.8rem;color:#aaa;padding-top:0;border-top:none">
      <span class="lbl" style="padding-left:8px">└ ${fmt(pTotal)} − 부가세 ${fmt(Math.floor(pTotal*0.1))} − 원가 ${fmt(Math.floor(pTotal*0.5))} = ${fmt(pProfit)} × ${pRate}%</span>
      <span></span>
    </div>` : ''}
    <div class="calc-row sec">
      <span class="lbl" style="font-weight:600">급여 합계 (시술+점판)</span>
      <span class="val">${fmt(gross)}원</span>
    </div>
    <div class="calc-row">
      <span class="lbl"><span class="tag-d">−</span> 소득세 (3%)</span>
      <span class="val" style="color:#c0392b">- ${fmt(it)}원</span>
    </div>
    <div class="calc-row">
      <span class="lbl"><span class="tag-d">−</span> 지방소득세 (0.3%)</span>
      <span class="val" style="color:#c0392b">- ${fmt(lt)}원</span>
    </div>
    ${purTotal > 0 ? `
    <div class="calc-row">
      <span class="lbl"><span class="tag-d">−</span> 차감항목 (${purItems.length}건)</span>
      <span class="val" style="color:#c0392b">- ${fmt(purTotal)}원</span>
    </div>
    <div class="calc-row">
      <span class="lbl" style="font-size:.82rem;color:#888">과세 기준액</span>
      <span class="val" style="font-size:.88rem">${fmt(taxable)}원</span>
    </div>` : ''}
    <div class="calc-row net">
      <span class="lbl">💳 최종 실입금액</span>
      <span class="val">${fmt(net)}원</span>
    </div>
  `;
}

// ── 저장 ────────────────────────────────────────────────────────────────────
async function saveSalary() {
  if (!salesData || !selectedEmpId) return;
  const year  = parseInt(document.getElementById('sel-year').value);
  const month = parseInt(document.getElementById('sel-month').value);
  const productItems = getProductItems();

  const body = {
    employee_id:    selectedEmpId,
    year, month,
    service_total:  salesData.service_total || 0,
    product_items:  productItems,
    purchase_items: getPurchaseItems(),
    payment_details: {
      cash: salesData.cash, card: salesData.card,
      pay:  salesData.pay,  coupon: salesData.coupon,
    },
  };

  const r = await fetch('/salary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await r.json();
  if (result.ok) {
    showToast('✅ 저장 완료!');
    renderEmpGrid();   // 직원 카드 갱신
  } else {
    showToast('저장 실패: ' + (result.error||''));
  }
}

// ── PDF 다운로드 ─────────────────────────────────────────────────────────────
async function downloadPdf() {
  if (!salesData || !selectedEmpId) return;
  const year  = parseInt(document.getElementById('sel-year').value);
  const month = parseInt(document.getElementById('sel-month').value);
  const productItems = getProductItems();

  const r = await fetch('/payslip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_id:    selectedEmpId,
      year, month,
      service_total:  salesData.service_total || 0,
      product_items:  productItems,
      purchase_items: getPurchaseItems(),
      xls_filename:   salesData.xls_filename || '',
    }),
  });
  if (!r.ok) { const e = await r.json(); showToast('오류: '+e.error); return; }
  const blob = await r.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  // 파일명 직접 구성 (헤더 파싱 인코딩 문제 방지)
  const year   = parseInt(document.getElementById('sel-year').value);
  const monthV = parseInt(document.getElementById('sel-month').value);
  const emp    = employees.find(e => e.id === selectedEmpId);
  const xls    = salesData?.xls_filename || '';
  a.download = xls
    ? `${xls}.pdf`
    : `${year}년${String(monthV).padStart(2,'0')}월_${emp?.name||''}.pdf`;
  a.href = url; a.click();
  URL.revokeObjectURL(url);
  showToast('📄 PDF 다운로드 완료!');
}

async function deleteSalary(empId, year, month) {
  if (!confirm(`${year}년 ${month}월 급여 기록을 삭제할까요?`)) return;
  await fetch(`/salary/${empId}/${year}/${month}`, { method:'DELETE' });
  showToast('삭제되었습니다');
  renderEmpGrid();
}

// 3번: 직원관리에서 ✏️ 클릭 → 급여계산 탭으로 이동 후 기록 로드
async function loadSavedRecord(empId, year, month) {
  const r = await fetch(`/salary/${empId}/${year}/${month}`);
  if (r.status === 204) { showToast('기록을 찾을 수 없습니다'); return; }
  const rec = await r.json();

  // 급여계산 탭으로 전환
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-payroll').classList.add('active');
  document.querySelector('.tab-btn').classList.add('active');

  // 직원 선택 (초기화 없이)
  selectedEmpId = empId;
  renderEmpSelector();

  // 연도/월 세팅
  document.getElementById('sel-year').value  = year;
  document.getElementById('sel-month').value = parseInt(month);

  await loadRecordData(rec, empId, parseInt(year), parseInt(month));
  showToast(`${year}년 ${month}월 기록 불러왔습니다`);
}

// ── 1번: 연/월 변경 시 저장된 기록 자동 로드 ────────────────────────────────
async function checkSavedRecord() {
  if (!selectedEmpId) return;
  const year  = document.getElementById('sel-year').value;
  const month = document.getElementById('sel-month').value;
  if (!year || !month) return;

  const r = await fetch(`/salary/${selectedEmpId}/${year}/${month}`);

  if (r.status === 204) {
    // 기록 없음 → 빈 폼으로 초기화
    salesData = null;
    document.getElementById('sales-summary').style.display = 'none';
    document.getElementById('detect-banner').classList.remove('show');
    // 업로드 존 초기화
    resetUploadZone();
    return;
  }

  // 기록 있음 → 자동 로드
  const rec = await r.json();
  await loadRecordData(rec, selectedEmpId, parseInt(year), parseInt(month));
}

function resetUploadZone() {
  document.getElementById('upload-zone').innerHTML = `
    <div class="icon">📂</div>
    <p>POS 매출 엑셀(.xls) 파일을 클릭하거나 드래그</p>
    <div class="hint">파일명: 이름_N월.xls → 직원·기간 자동 인식</div>
    <input type="file" id="file-input" accept=".xls,.xlsx" style="display:none"
           onchange="uploadFile(this.files[0])">`;
}

async function loadRecordData(rec, empId, year, month) {
  const emp = employees.find(e => e.id === empId);
  salesData = {
    emp_name: emp?.name || '',
    month, year,
    xls_filename:    '',
    service_total:   rec.service_total   || 0,
    service_count:   0,
    service_cash:    rec.payment_details?.cash  || 0,
    service_card:    rec.payment_details?.card  || 0,
    service_pay:     rec.payment_details?.pay   || 0,
    service_bank:    rec.payment_details?.bank  || 0,
    product_total:   rec.product_total   || 0,
    product_count:   0,
    product_cash: 0, product_card: 0, product_pay: 0, product_bank: 0,
    total: (rec.service_total||0) + (rec.product_total||0),
    details: [],
  };

  // 요약 카드
  document.getElementById('s-service-total').textContent = fmt(salesData.service_total)+'원';
  document.getElementById('s-scnt').textContent  = '-';
  document.getElementById('s-scash').textContent = fmt(salesData.service_cash);
  document.getElementById('s-scard').textContent = fmt(salesData.service_card);
  document.getElementById('s-spay').textContent  = fmt(salesData.service_pay);
  document.getElementById('s-product-total').textContent = salesData.product_total > 0 ? fmt(salesData.product_total)+'원' : '없음';
  document.getElementById('s-pcnt').textContent  = '-';
  document.getElementById('s-pcash').textContent = '0';
  document.getElementById('s-pcard').textContent = '0';
  document.getElementById('s-ppay').textContent  = '0';

  // 점판·차감항목 복원
  initProductTable(rec.product_items || []);
  const purTbody = document.getElementById('purchase-tbody');
  purTbody.innerHTML = '';
  (rec.purchase_items || []).forEach(item => addPurchaseRow(item.name, item.amount));
  if (!purTbody.querySelector('input')) {
    purTbody.innerHTML = '<tr><td colspan="3" style="color:#bbb;text-align:center;padding:10px">차감 항목 없음</td></tr>';
  }
  updatePurchaseTotal();

  // 업로드 존 → 불러온 기록 표시
  document.getElementById('upload-zone').innerHTML = `
    <div class="icon">📋</div>
    <p>저장된 기록 (${year}년 ${month}월) — 아래에서 수정 후 다시 저장 가능</p>
    <div class="hint">새 파일 업로드하려면 클릭</div>
    <input type="file" id="file-input" accept=".xls,.xlsx" style="display:none" onchange="uploadFile(this.files[0])">`;

  // 배너
  document.getElementById('detect-banner').classList.add('show');
  document.getElementById('detect-text').textContent = `${year}년 ${month}월 저장된 기록 불러옴 — 수정 후 저장 버튼으로 덮어쓰기 가능`;

  document.getElementById('sales-summary').style.display = 'block';
  renderCalc();
}

document.getElementById('sel-year').addEventListener('change', checkSavedRecord);
document.getElementById('sel-month').addEventListener('change', checkSavedRecord);

// ── 5번: 매출 내역 탭 직원 체크박스 렌더 ────────────────────────────────────
let historyChecked = new Set();   // 선택된 직원 id
let historyAllData = {};          // {empId: {records}}

async function renderHistoryEmpCheckboxes() {
  const box = document.getElementById('history-emp-checkboxes');
  if (!employees.length) { box.innerHTML = '<span style="color:#aaa;font-size:.82rem">직원 없음</span>'; return; }
  box.innerHTML = employees.map(e => `
    <div class="emp-check-item ${historyChecked.has(e.id)?'checked':''}"
         onclick="toggleHistoryEmp('${e.id}', this)">
      ${historyChecked.has(e.id) ? '✓ ' : ''}${e.name}
    </div>
  `).join('');
}

async function toggleHistoryEmp(id, el) {
  if (historyChecked.has(id)) {
    historyChecked.delete(id);
    el.classList.remove('checked');
    el.textContent = el.textContent.replace('✓ ', '');
  } else {
    historyChecked.add(id);
    el.classList.add('checked');
    el.textContent = '✓ ' + el.textContent;
    if (!historyAllData[id]) {
      const r = await fetch(`/salary/${id}`);
      historyAllData[id] = await r.json();
    }
  }
  renderHistoryCombined();
}

function renderHistoryCombined() {
  const area = document.getElementById('detail-area');
  if (!historyChecked.size) {
    area.innerHTML = '<p style="color:#aaa;text-align:center;padding:30px">직원을 선택하면 저장된 월별 기록이 표시됩니다</p>';
    return;
  }

  let rows = '';
  let totalNet = 0;
  for (const empId of historyChecked) {
    const emp  = employees.find(e => e.id === empId);
    const recs = historyAllData[empId] || {};
    const keys = Object.keys(recs).sort().reverse();
    if (!keys.length) {
      rows += `<tr><td colspan="7" style="background:#f8f9fa;padding:8px 12px;color:#aaa">${emp?.name||empId} — 저장된 기록 없음</td></tr>`;
      continue;
    }
    rows += `<tr><td colspan="7" style="background:#eef3fc;font-weight:700;padding:7px 12px;color:#4472C4">${emp?.name||empId}</td></tr>`;
    keys.forEach(k => {
      const rec = recs[k];
      totalNet += (rec.payroll?.net || 0);
      rows += `<tr>
        <td>${rec.year}년 ${rec.month}월</td>
        <td style="text-align:right">${fmt(rec.service_total)}</td>
        <td style="text-align:right">${rec.product_total ? fmt(rec.product_total) : '-'}</td>
        <td style="text-align:right;color:#c0392b">${rec.purchase_total ? '-'+fmt(rec.purchase_total) : '-'}</td>
        <td style="text-align:right;color:#c0392b">-${fmt(rec.payroll?.deduction||0)}</td>
        <td style="text-align:right;font-weight:700;color:#4472C4">${fmt(rec.payroll?.net||0)}원</td>
        <td style="text-align:center">
          <span style="cursor:pointer;color:#4472C4;font-size:.8rem"
                onclick="loadSavedRecord('${empId}','${rec.year}','${rec.month}')">✏️</span>
        </td>
      </tr>`;
    });
  }

  area.innerHTML = `
    <table class="detail-table">
      <thead><tr>
        <th>기간</th>
        <th style="text-align:right">시술매출</th>
        <th style="text-align:right">점판매출</th>
        <th style="text-align:right">차감항목</th>
        <th style="text-align:right">세금공제</th>
        <th style="text-align:right">실입금액</th>
        <th style="text-align:center">수정</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── 매출 내역 탭 ────────────────────────────────────────────────────────────
function renderDetailTable(details) {
  allDetails = details || [];
  applyDetailFilter('all');
  document.querySelector('.filter-btn.active')?.classList.remove('active');
  document.querySelector('.filter-btn')?.classList.add('active');
}

function filterDetail(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyDetailFilter(type);
}

function applyDetailFilter(type) {
  const area = document.getElementById('detail-area');
  if (!allDetails.length) return;
  const rows = type === 'all' ? allDetails
             : allDetails.filter(d => d.category === type);
  if (!rows.length) {
    area.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">해당 항목 없음</p>'; return;
  }
  area.innerHTML = `
    <table class="detail-table">
      <thead><tr>
        <th>분류</th><th>메뉴명</th>
        <th style="text-align:right">건수</th>
        <th style="text-align:right">합계금액</th>
        <th style="text-align:right">현금</th>
        <th style="text-align:right">카드</th>
        <th style="text-align:right">Pay</th>
        <th style="text-align:right">통장</th>
        <th style="text-align:right">평균단가</th>
      </tr></thead>
      <tbody>
        ${rows.map(d=>`
          <tr class="row-${d.category}">
            <td><span class="cat-badge cat-${d.category}">${d.category==='service'?'시술':'점판'}</span></td>
            <td>${d.menu}</td>
            <td style="text-align:right">${d.count}</td>
            <td style="text-align:right"><b>${fmt(d.amount)}</b></td>
            <td style="text-align:right">${d.cash   ? fmt(d.cash)   : '-'}</td>
            <td style="text-align:right">${d.card   ? fmt(d.card)   : '-'}</td>
            <td style="text-align:right">${d.pay    ? fmt(d.pay)    : '-'}</td>
            <td style="text-align:right">${d.bank ? fmt(d.bank) : '-'}</td>
            <td style="text-align:right">${d.avg_price ? fmt(d.avg_price) : '-'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── 직원 CRUD ────────────────────────────────────────────────────────────────
function openModal(id=null) {
  editingId = id;
  const emp = id ? employees.find(e=>e.id===id) : null;
  document.getElementById('modal-title').textContent = id ? '직원 수정' : '직원 추가';
  document.getElementById('f-name').value  = emp?.name  || '';
  document.getElementById('f-salon').value = emp?.salon || '';
  document.getElementById('f-rate').value  = emp?.commission_rate || '';
  document.getElementById('f-prate').value = emp?.product_commission_rate || '';
  document.getElementById('f-role').value  = emp?.role  || '';
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('f-name').focus(), 100);
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
}
async function saveEmployee() {
  const name  = document.getElementById('f-name').value.trim();
  const salon = document.getElementById('f-salon').value.trim();
  const rate  = parseFloat(document.getElementById('f-rate').value);
  const prate = parseFloat(document.getElementById('f-prate').value) || 50;
  const role  = document.getElementById('f-role').value.trim();
  if (!name || isNaN(rate)) { showToast('이름과 시술 수수료율은 필수입니다'); return; }
  const body = { name, salon, commission_rate: rate, product_commission_rate: prate, role };
  const url    = editingId ? `/employees/${editingId}` : '/employees';
  const method = editingId ? 'PUT' : 'POST';
  await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  closeModal();
  await loadEmployees();
  if (salesData) renderCalc();
  showToast(editingId ? '수정 완료' : '직원 추가 완료');
}
async function deleteEmployee(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  await fetch(`/employees/${id}`, { method:'DELETE' });
  if (selectedEmpId===id) { selectedEmpId=null; renderCalc(); }
  await loadEmployees();
  showToast('삭제되었습니다');
}

function fmt(n) { return (n||0).toLocaleString('ko-KR'); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
}
document.getElementById('modal-overlay').addEventListener('click', e=>{
  if (e.target===e.currentTarget) closeModal();
});

loadEmployees();
