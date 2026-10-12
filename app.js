// Đọc rules.json rồi tính kết quả hoàn toàn ở trình duyệt, không có backend.
const $ = (id) => document.getElementById(id);

// Mức phạt theo % quá tải: lớn hơn min, tới hết max (max null = không giới hạn).
function overloadFine(rules, pct) {
  return rules.fines.find((f) => pct > f.min && (f.max === null || pct <= f.max)) || null;
}

function check(rules, vehicleId, cargoId, load) {
  const v = rules.vehicles.find((x) => x.id === vehicleId);
  const c = rules.cargo.find((x) => x.id === cargoId);
  const zone = rules.zones[v.zone];
  const pct = ((load - v.maxLoadT) / v.maxLoadT) * 100;
  return { v, c, zone, pct, fine: overloadFine(rules, pct) };
}

function render(rules, r) {
  const tag = `<span class="tag">${rules.unverified}</span>`;
  const loadLine = r.pct > 0
    ? `<p class="warn">Quá tải ${Math.round(r.pct * 10) / 10}% so với tải trọng cho phép (${r.v.maxLoadT} tấn).</p>`
    : `<p class="ok">Trong tải trọng cho phép (${r.v.maxLoadT} tấn).</p>`;
  const risks = [...(r.fine ? [r.fine] : []), ...rules.otherFines];
  $('result').innerHTML = `
    <div class="card"><h2>🛣 Tuyến đường ${r.zone.verified ? '' : tag}</h2>
      <p class="${r.zone.verified ? 'ok' : ''}">${r.zone.allowed}</p><p>${r.zone.restricted}</p></div>
    <div class="card"><h2>⚖ Tải trọng</h2>${loadLine}</div>
    <div class="card"><h2>🪪 Hạng bằng lái cần có</h2><p>${r.v.class ? `<b>Hạng ${r.v.class}</b>` : tag}</p></div>
    ${r.c.extra ? `<div class="card"><h2>📦 Lưu ý loại hàng</h2><p>${r.c.extra}</p></div>` : ''}
    <div class="card"><h2>💸 Mức phạt nếu vi phạm ${tag}</h2>
      <ul>${risks.map((f) => `<li><b>${f.text}:</b> ${f.amount}${f.ref ? ` (${f.ref})` : ''}</li>`).join('')}</ul>
      <p class="src">${rules.finesSource}</p></div>`;
  $('result').scrollIntoView({ behavior: 'smooth' });
}

if (typeof document !== 'undefined') {
  fetch('rules.json')
    .then((res) => res.json())
    .then((rules) => {
      $('vehicle').innerHTML = rules.vehicles.map((v) => `<option value="${v.id}">${v.name}</option>`).join('');
      $('cargo').innerHTML = rules.cargo.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
      $('ver').textContent = `${rules.city} · dữ liệu ${rules.version}`;
      $('form').addEventListener('submit', (e) => {
        e.preventDefault();
        // Ô nhập là text để gõ được dấu phẩy thập phân (vd. 3,5) trên bàn phím tiếng Việt.
        const load = parseFloat($('load').value.replace(',', '.'));
        if (!(load > 0)) {
          $('result').innerHTML = '<p class="warn">Nhập khối lượng hàng lớn hơn 0 (tấn), vd. 3,5.</p>';
          return;
        }
        render(rules, check(rules, $('vehicle').value, $('cargo').value, load));
      });
    })
    .catch(() => { $('result').innerHTML = '<p class="warn">Không tải được dữ liệu luật.</p>'; });
}

if (typeof module !== 'undefined') module.exports = { check };
