/* ─── DTC Admin — Payments Module ───────────────────────────────────────── */
'use strict';

const Payments = (() => {

  let _payments = [];
  let _admins   = [];
  let _filter   = 'all';   // all | received | pending | refunded
  let _adminFilter = '';   // '' = all admins

  const METHODS = ['WeChat Pay', 'Alipay', 'Bank Transfer', 'PayPal', 'Cash', 'USDT', 'Other'];

  /* ── load ─────────────────────────────────────────────────────────────── */
  const load = async () => {
    const d = await api(`/admin/payments?adminKey=${encodeURIComponent(Store.adminKey)}`);
    if (!d) return;
    _payments = d.payments || [];
    _admins   = d.admins   || [];
    render();
  };

  /* ── render ───────────────────────────────────────────────────────────── */
  const render = () => {
    const wrap = document.getElementById('payments-page');
    if (!wrap) return;

    const filtered = _payments.filter(p => {
      if (_filter !== 'all' && p.status !== _filter) return false;
      if (_adminFilter && p.adminId !== _adminFilter) return false;
      return true;
    });

    // Summary stats
    const totalAll      = _payments.filter(p=>p.status==='received').reduce((s,p)=>s+p.amount,0);
    const totalPending  = _payments.filter(p=>p.status==='pending').reduce((s,p)=>s+p.amount,0);
    const totalRefunded = _payments.filter(p=>p.status==='refunded').reduce((s,p)=>s+p.amount,0);
    const sym = (_payments[0]&&_payments[0].currencySymbol) || '$';

    // Admin summary cards
    const byAdmin = {};
    _payments.filter(p=>p.status==='received').forEach(p => {
      if (!byAdmin[p.adminId]) byAdmin[p.adminId] = { name: p.adminName||'Unknown', total: 0, count: 0, methods: {} };
      byAdmin[p.adminId].total += p.amount;
      byAdmin[p.adminId].count++;
      byAdmin[p.adminId].methods[p.method] = (byAdmin[p.adminId].methods[p.method]||0)+p.amount;
    });

    const adminCards = Object.entries(byAdmin).map(([aid, g]) => {
      const adm = _admins.find(a=>a.id===aid);
      const methodList = Object.entries(g.methods).map(([m,v])=>`<span class="pay-method-chip">${esc(m)}: ${sym}${v.toFixed(2)}</span>`).join('');
      const color = _adminColor(aid);
      return `
        <div class="admin-pay-card ${_adminFilter===aid?'admin-pay-card--active':''}" onclick="Payments.setAdminFilter('${esc(aid)}')">
          <div class="apc-avatar" style="background:${color}">${esc(g.name).charAt(0).toUpperCase()}</div>
          <div class="apc-info">
            <div class="apc-name">${esc(g.name)}</div>
            ${adm&&adm.role?`<div class="apc-role">${esc(adm.role)}</div>`:''}
          </div>
          <div class="apc-right">
            <div class="apc-total">${sym}${g.total.toFixed(2)}</div>
            <div class="apc-count">${g.count} payment${g.count!==1?'s':''}</div>
          </div>
          <div class="apc-methods">${methodList}</div>
        </div>`;
    }).join('') || `<div class="empty" style="padding:.8rem">No payments recorded yet.</div>`;

    // Filter bar
    const statusFilters = ['all','received','pending','refunded'].map(f => `
      <button class="fb ${_filter===f?'active':''}" onclick="Payments.setFilter('${f}',this)">${f.charAt(0).toUpperCase()+f.slice(1)}</button>`).join('');

    const adminFilterOpts = `<option value="">All Staff</option>` +
      _admins.map(a=>`<option value="${esc(a.id)}" ${_adminFilter===a.id?'selected':''}>${esc(a.name)}</option>`).join('');

    // Payment table rows
    const rows = filtered.length ? filtered.map(p => {
      const color = _adminColor(p.adminId);
      const statusClass = p.status==='received'?'pay-st--received':p.status==='pending'?'pay-st--pending':'pay-st--refunded';
      const statusLabel = p.status==='received'?'✓ Received':p.status==='pending'?'⏳ Pending':'↩ Refunded';
      return `
        <tr>
          <td style="font-weight:700;color:var(--success)">${sym}${p.amount.toFixed(2)}</td>
          <td><span class="pay-method-chip">${esc(p.method||'—')}</span></td>
          <td>
            <div style="display:flex;align-items:center;gap:.4rem">
              <div style="width:22px;height:22px;border-radius:50%;background:${color};color:#fff;font-size:.7rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${esc(p.adminName||'?').charAt(0).toUpperCase()}</div>
              <span>${esc(p.adminName||'—')}</span>
            </div>
          </td>
          <td>${esc(p.customerName||'—')}</td>
          <td>${p.paidAt?new Date(p.paidAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—'}</td>
          <td>${p.note?`<span title="${esc(p.note)}" style="max-width:120px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom">${esc(p.note)}</span>`:'—'}</td>
          <td><span class="pay-status ${statusClass}">${statusLabel}</span></td>
          <td>
            <div style="display:flex;gap:.3rem">
              <button class="btn btn-sm" style="padding:.2rem .5rem;font-size:.7rem;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8" onclick="Payments.openEdit('${esc(p.id)}')">✏</button>
              <button class="btn btn-sm" style="padding:.2rem .5rem;font-size:.7rem;background:#fef2f2;border:1px solid #fecaca;color:#dc2626" onclick="Payments.deletePayment('${esc(p.id)}')">🗑</button>
            </div>
          </td>
        </tr>`;
    }).join('') : `<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:var(--muted)">No payments match this filter.</td></tr>`;

    wrap.innerHTML = `
      <!-- Stats -->
      <div class="stats" style="margin-bottom:1.2rem">
        <div class="stat"><div class="stat-val sv-green">${sym}${totalAll.toFixed(2)}</div><div class="stat-lbl">Total Received</div></div>
        <div class="stat"><div class="stat-val sv-warn">${sym}${totalPending.toFixed(2)}</div><div class="stat-lbl">Pending</div></div>
        <div class="stat"><div class="stat-val sv-red">${sym}${totalRefunded.toFixed(2)}</div><div class="stat-lbl">Refunded</div></div>
        <div class="stat"><div class="stat-val">${_payments.length}</div><div class="stat-lbl">Total Records</div></div>
      </div>

      <!-- Admin summary cards -->
      <div class="card" style="margin-bottom:1.2rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem;flex-wrap:wrap;gap:.5rem">
          <div class="card-title" style="margin-bottom:0">💳 Payments by Staff Member</div>
          ${_adminFilter?`<button class="btn btn-sm" style="font-size:.72rem" onclick="Payments.setAdminFilter('')">✕ Clear filter</button>`:''}
        </div>
        <div class="admin-pay-cards">${adminCards}</div>
      </div>

      <!-- Add payment -->
      <div class="card" style="margin-bottom:1.2rem">
        <div class="card-title" style="margin-bottom:.8rem">➕ Record New Payment</div>
        ${_admins.length ? _addPaymentForm() : `<div class="empty">Add staff members in <a href="#" onclick="Shell.navigate('staff',null)">Staff Settings</a> first.</div>`}
      </div>

      <!-- Filters + table -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.6rem;margin-bottom:.8rem">
          <div class="card-title" style="margin-bottom:0">📋 Payment History (${filtered.length})</div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
            <div class="filters" style="margin-bottom:0">${statusFilters}</div>
            <select style="font-size:.75rem;padding:.3rem .6rem;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text)" onchange="Payments.setAdminFilter(this.value)">${adminFilterOpts}</select>
          </div>
        </div>
        <div class="pay-table-wrap">
          <table class="keys-table">
            <thead><tr>
              <th>Amount</th><th>Method</th><th>Received By</th><th>Customer</th>
              <th>Date</th><th>Note</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  };

  /* ── add payment form ─────────────────────────────────────────────────── */
  const _addPaymentForm = () => {
    const adminOpts = _admins.map(a=>`<option value="${esc(a.id)}" data-name="${esc(a.name)}">${esc(a.name)} (${esc(a.role||'Staff')})</option>`).join('');
    const methodOpts = METHODS.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');
    const settings   = Store.settings || {};
    const sym        = settings.currencySymbol || '$';
    const now        = new Date().toISOString().slice(0,16);
    return `
      <div class="form-row">
        <div class="form-group" style="margin-bottom:0">
          <label>Amount (${sym})</label>
          <input id="pay-amount" type="number" min="0.01" step="0.01" placeholder="0.00" style="font-weight:700;color:var(--success)"/>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Payment Method</label>
          <select id="pay-method">${methodOpts}</select>
        </div>
      </div>
      <div class="form-row" style="margin-top:.6rem">
        <div class="form-group" style="margin-bottom:0">
          <label>Received By (Staff)</label>
          <select id="pay-admin">${adminOpts}</select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Date Paid</label>
          <input id="pay-date" type="datetime-local" value="${now}"/>
        </div>
      </div>
      <div class="form-row" style="margin-top:.6rem">
        <div class="form-group" style="margin-bottom:0">
          <label>Customer Name <span style="color:var(--muted);font-size:.65rem">(optional)</span></label>
          <input id="pay-customer" placeholder="e.g. Ahmed Khan"/>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Status</label>
          <select id="pay-status">
            <option value="received">✓ Received</option>
            <option value="pending">⏳ Pending</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top:.6rem;margin-bottom:0">
        <label>Note <span style="color:var(--muted);font-size:.65rem">(optional)</span></label>
        <input id="pay-note" placeholder="e.g. Renewal for Claude Pro, paid via WeChat 2026-05-01"/>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:.8rem" onclick="Payments.addPayment()">Record Payment</button>
      <span id="pay-add-msg" style="font-size:.78rem;margin-left:.6rem;color:var(--success)"></span>`;
  };

  /* ── actions ──────────────────────────────────────────────────────────── */
  const addPayment = async () => {
    const amount   = parseFloat(document.getElementById('pay-amount').value);
    const method   = document.getElementById('pay-method').value;
    const adminSel = document.getElementById('pay-admin');
    const adminId  = adminSel.value;
    const adminName= adminSel.options[adminSel.selectedIndex]?.dataset.name || '';
    const date     = document.getElementById('pay-date').value;
    const customer = document.getElementById('pay-customer').value.trim();
    const status   = document.getElementById('pay-status').value;
    const note     = document.getElementById('pay-note').value.trim();
    const settings = Store.settings || {};

    if (!amount || amount <= 0) { alert('Enter a valid amount.'); return; }
    if (!adminId) { alert('Select the staff member who received this payment.'); return; }

    const d = await api('/admin/payments/add', {
      adminKey: Store.adminKey,
      payment: {
        amount, method, adminId, adminName,
        customerName: customer,
        paidAt: date ? new Date(date).toISOString() : new Date().toISOString(),
        note, status,
        currency: settings.currency || 'USD',
        currencySymbol: settings.currencySymbol || '$',
      }
    });

    const msg = document.getElementById('pay-add-msg');
    if (d && d.success) {
      if (msg) { msg.style.color='var(--success)'; msg.textContent = '✓ Payment recorded!'; setTimeout(()=>{if(msg)msg.textContent='';},3000); }
      await load();
    } else {
      if (msg) { msg.style.color='var(--error)'; msg.textContent = '✕ '+(d&&d.error||'Failed'); }
    }
  };

  const openEdit = (id) => {
    const p = _payments.find(p=>p.id===id); if(!p) return;
    const adminOpts  = _admins.map(a=>`<option value="${esc(a.id)}" data-name="${esc(a.name)}" ${a.id===p.adminId?'selected':''}>${esc(a.name)} (${esc(a.role||'Staff')})</option>`).join('');
    const methodOpts = METHODS.map(m=>`<option value="${esc(m)}" ${m===p.method?'selected':''}>${esc(m)}</option>`).join('');
    const paidAt     = p.paidAt ? p.paidAt.slice(0,16) : '';
    _showModal(`
      <div class="modal-header"><h3>✏ Edit Payment</h3></div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>Amount</label><input id="ep-amount" type="number" min="0.01" step="0.01" value="${p.amount.toFixed(2)}"/></div>
          <div class="form-group"><label>Method</label><select id="ep-method">${methodOpts}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Received By</label><select id="ep-admin">${adminOpts}</select></div>
          <div class="form-group"><label>Date Paid</label><input id="ep-date" type="datetime-local" value="${esc(paidAt)}"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Customer</label><input id="ep-customer" value="${esc(p.customerName||'')}"/></div>
          <div class="form-group"><label>Status</label>
            <select id="ep-status">
              <option value="received" ${p.status==='received'?'selected':''}>✓ Received</option>
              <option value="pending"  ${p.status==='pending'?'selected':''}>⏳ Pending</option>
              <option value="refunded" ${p.status==='refunded'?'selected':''}>↩ Refunded</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>Note</label><input id="ep-note" value="${esc(p.note||'')}"/></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-sm" onclick="Payments._closeModal()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="Payments._saveEdit('${esc(id)}')">Save</button>
      </div>`);
  };

  const _saveEdit = async (id) => {
    const adminSel = document.getElementById('ep-admin');
    const updates = {
      amount:       parseFloat(document.getElementById('ep-amount').value),
      method:       document.getElementById('ep-method').value,
      adminId:      adminSel.value,
      adminName:    adminSel.options[adminSel.selectedIndex]?.dataset.name || '',
      paidAt:       new Date(document.getElementById('ep-date').value).toISOString(),
      customerName: document.getElementById('ep-customer').value.trim(),
      status:       document.getElementById('ep-status').value,
      note:         document.getElementById('ep-note').value.trim(),
    };
    const d = await api('/admin/payments/edit', { adminKey: Store.adminKey, id, updates });
    _closeModal();
    if (d&&d.success) await load();
    else alert('✕ Failed: '+(d&&d.error||'Unknown'));
  };

  const deletePayment = async (id) => {
    if (!confirm('Delete this payment record?')) return;
    const d = await api('/admin/payments/delete', { adminKey: Store.adminKey, id });
    if (d&&d.success) await load();
    else alert('✕ Failed.');
  };

  const setFilter = (f) => { _filter = f; render(); };
  const setAdminFilter = (id) => { _adminFilter = _adminFilter===id?'':id; render(); };

  /* ── admin color palette ─────────────────────────────────────────────── */
  const _palette = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2','#65a30d'];
  const _adminColor = (id) => {
    const idx = Math.abs([...String(id)].reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0,0)) % _palette.length;
    return _palette[idx];
  };

  /* ── modal ────────────────────────────────────────────────────────────── */
  const _showModal = (html) => {
    let m = document.getElementById('pay-modal-overlay');
    if (!m) { m=document.createElement('div'); m.id='pay-modal-overlay'; m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem'; m.addEventListener('click',e=>{if(e.target===m)_closeModal();}); document.body.appendChild(m); }
    m.innerHTML = `<div class="cust-modal">${html}</div>`;
    m.style.display='flex';
  };
  const _closeModal = () => { const m=document.getElementById('pay-modal-overlay'); if(m) m.style.display='none'; };

  return { load, render, addPayment, openEdit, _saveEdit, deletePayment, setFilter, setAdminFilter, _closeModal };
})();
