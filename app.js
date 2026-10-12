// Đọc rules.json rồi tính kết quả hoàn toàn ở trình duyệt, không có backend.
const MAX_T = 100; // trên mức này coi là nhập nhầm đơn vị (kg thay vì tấn)
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const vn = (n, d = 2) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');

const TAG_NO = '<span class="tag no">⚠ Chưa xác minh</span>';
const tagYes = (src) => `<span class="tag yes">✓ Đã xác minh · ${esc(src)}</span>`;

// Trả về { value } hoặc { error }. Chỉ nhận số thuần: 3 | 3,5 | 3.5 (không parseFloat vì nó nuốt "3abc", "1e3").
function parseWeight(raw) {
  const s = String(raw).trim();
  if (s === '') return { error: 'Nhập khối lượng hàng, ví dụ 3,5.' };
  if (/^-/.test(s) || /^[0.,\s]+$/.test(s)) return { error: 'Khối lượng phải lớn hơn 0 tấn.' };
  if (!/^\d+([.,]\d{1,3})?$/.test(s)) return { error: 'Chỉ nhập số, ví dụ 3,5 hoặc 3.5.' };
  const value = parseFloat(s.replace(',', '.'));
  if (!(value > 0)) return { error: 'Khối lượng phải lớn hơn 0 tấn.' };
  if (value > MAX_T) return { error: `Tối đa ${MAX_T} tấn. Kiểm tra lại đơn vị (tấn, không phải kg).` };
  return { value };
}

// Mức phạt theo % quá tải: lớn hơn min, tới hết max (max null = không giới hạn).
function overloadFine(rules, pct) {
  return rules.fines.find((f) => pct > f.min && (f.max === null || pct <= f.max)) || null;
}

function check(rules, vehicleId, cargoId, load) {
  const v = rules.vehicles.find((x) => x.id === vehicleId);
  const c = rules.cargo.find((x) => x.id === cargoId);
  const pct = ((load - v.maxLoadT) / v.maxLoadT) * 100;
  return { v, c, zone: rules.zones[v.zone], pct, fine: overloadFine(rules, pct), load };
}

// Thanh 24 giờ: đỏ = giờ cấm, xanh nhạt = được chạy.
function timeBar(ban) {
  const stops = [];
  let at = 0;
  const seg = (a, b, col) => { if (b > a) stops.push(`${col} ${(a / 24) * 100}% ${(b / 24) * 100}%`); };
  ban.forEach(([a, b]) => { seg(at, a, '#D8EFDD'); seg(a, b, '#B3261E'); at = b; });
  seg(at, 24, '#D8EFDD');
  const labels = ['0', '6', '12', '18', '24'].map((h) => `<span>${h}h</span>`).join('');
  return `<div class="timebar" role="img" aria-label="Thanh 24 giờ: đỏ là giờ cấm" style="background:linear-gradient(to right,${stops.join(',')})"></div><div class="ticks" aria-hidden="true">${labels}</div>`;
}

// Thứ tự thẻ: kết luận → giờ và tuyến → tải trọng → lưu ý hàng → mức phạt → hạng bằng.
function renderResult(rules, r) {
  const over = r.pct > 0;
  const level = !over ? 'ok' : r.pct <= 10 ? 'warn' : 'danger';
  const pctTxt = vn(Math.abs(r.pct), 1);
  const big = !over ? 'Không quá tải' : `Quá tải ${pctTxt}%`;
  const hoursShort = r.v.zone === 'heavy' ? 'Cấm 06:00–22:00, trừ hành lang riêng' : 'Cấm 06:00–09:00 và 16:00–20:00';
  const fineShort = !over ? 'Không bị phạt quá tải' : r.fine ? `Có thể bị phạt ${esc(r.fine.amount)}` : esc(rules.noFineBelow);
  const loadTag = r.v.maxLoadTVerified ? tagYes('nguồn') : TAG_NO;
  const zoneTag = r.zone.verified ? tagYes('caselaw.vn') : TAG_NO;

  const corr = r.zone.corridors.length
    ? r.zone.corridors.map((g) => `<details><summary>${esc(g.hours)}<small>${g.places.length} tuyến</small></summary><ul>${g.places.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details>`).join('')
    : '<p>Không có hành lang riêng. Chỉ cần tránh giờ cấm.</p>';
  const barPct = (Math.min(r.load / r.v.maxLoadT, 1.5) / 1.5) * 100;

  $('cards').innerHTML = `
  <article class="card verdict ${level}">
    <p class="big">${big}</p>
    <ul>
      <li><b>⚖ Tải:</b><span>${vn(r.load)} t so với giới hạn ${vn(r.v.maxLoadT)} t</span></li>
      <li><b>🕒 Giờ:</b><span>${hoursShort}</span></li>
      <li><b>💸 Phạt:</b><span>${fineShort}</span></li>
    </ul>
    <p>${TAG_NO} <span class="src">Giới hạn tải, mức phạt và hạng bằng là dữ liệu mẫu.</span></p>
  </article>

  <article class="card">
    <h2>🕒 Giờ và tuyến ${zoneTag}</h2>
    <p><b>${esc(r.zone.restricted)}</b></p>
    ${timeBar(r.zone.ban)}
    <p>${esc(r.zone.allowed)}</p>
    ${r.zone.corridors.length ? '<p><b>Hành lang được chạy (Điều 5):</b></p>' : ''}
    ${corr}
    <details><summary>Xe được miễn trừ<small>QĐ 23/2019</small></summary><p>${esc(rules.zonesExemptions)}</p></details>
    <p class="src">${esc(rules.zonesSource)}</p>
  </article>

  <article class="card">
    <h2>⚖ Tải trọng ${loadTag}</h2>
    <p><b>${vn(r.load)} t</b> / giới hạn <b>${vn(r.v.maxLoadT)} t</b> · ${over ? `<b class="bad">quá ${pctTxt}%</b>` : '<b class="good">trong mức cho phép</b>'}</p>
    <div class="loadbar ${over ? 'over' : ''}" role="img" aria-label="${over ? 'Quá tải' : 'Trong tải trọng'}"><i style="width:${barPct}%"></i><u style="left:${100 / 1.5}%"></u></div>
    <p class="src">Vạch đen = giới hạn tải của loại xe này.</p>
  </article>

  ${r.c.extra ? `<article class="card notice"><h2>📦 Lưu ý loại hàng</h2><p>${esc(r.c.extra)}</p></article>` : ''}

  <article class="card">
    <h2>💸 Mức phạt ${TAG_NO}</h2>
    ${over && r.fine ? `<span class="fine"><b>${esc(r.fine.amount)}</b><span>${esc(r.fine.text)} · ${esc(r.fine.ref)}</span></span>` : ''}
    ${over && !r.fine ? `<p><b>${esc(rules.noFineBelow)}</b></p>` : ''}
    ${!over ? '<p>Không quá tải nên không có mức phạt quá tải.</p>' : ''}
    ${rules.otherFines.map((f) => `<span class="fine"><b>${esc(f.amount)}</b><span>${esc(f.text)}</span></span>`).join('')}
    <p class="src">${esc(rules.finesSource)}</p>
  </article>

  <article class="card">
    <h2>🪪 Hạng bằng lái ${TAG_NO}</h2>
    <p>${r.v.class ? `<b>Hạng ${esc(r.v.class)}</b>` : 'Chưa có dữ liệu. Chưa xác minh nên chưa hiển thị hạng.'}</p>
  </article>`;
  $('summary').innerHTML = `<b>${esc(r.v.name)}</b> · ${esc(r.c.name)} · <b>${vn(r.load)} t</b>`;
}

// ---------- điều khiển giao diện (chỉ chạy trong trình duyệt) ----------
if (typeof document !== 'undefined') {
  let rules = null;
  const show = (view) => {
    $('viewForm').hidden = view !== 'form';
    $('viewResult').hidden = view !== 'result';
    window.scrollTo(0, 0);
  };
  const setLoadErr = (msg) => {
    $('loadField').classList.toggle('err', !!msg);
    $('loadErr').textContent = msg || '';
    $('load').setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const setMode = (mode) => { // 'ready' | 'loading' | 'fail'
    $('form').hidden = mode !== 'ready';
    $('loadingBox').hidden = mode !== 'loading';
    $('failBox').hidden = mode !== 'fail';
    $('submit').disabled = mode !== 'ready';
    $('submit').textContent = mode === 'loading' ? 'Đang tải dữ liệu…' : 'Kiểm tra';
    $('submit').hidden = mode === 'fail';
  };

  const loadRules = () => {
    setMode('loading');
    fetch('rules.json')
      .then((res) => { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then((data) => {
        rules = data;
        $('vehicle').innerHTML = rules.vehicles.map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join('');
        $('cargo').innerHTML = rules.cargo.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
        $('ver').textContent = `${rules.city} · dữ liệu ${rules.version}`;
        setMode('ready');
      })
      .catch(() => setMode('fail'));
  };

  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!rules) return;
    // Ô nhập là text để gõ được dấu phẩy thập phân (vd. 3,5) trên bàn phím tiếng Việt.
    const p = parseWeight($('load').value);
    if (p.error) { setLoadErr(p.error); $('load').focus(); return; }
    setLoadErr('');
    renderResult(rules, check(rules, $('vehicle').value, $('cargo').value, p.value));
    show('result');
    $('t2').focus({ preventScroll: true });
  });
  $('load').addEventListener('input', () => setLoadErr(''));
  $('back').addEventListener('click', () => { show('form'); $('load').focus(); });
  $('retry').addEventListener('click', loadRules);
  loadRules();
}

if (typeof module !== 'undefined') module.exports = { parseWeight, check, vn };
