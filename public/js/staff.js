/* ─── DTC Admin — Staff Module ───────────────────────────────────────────── */
'use strict';

const Staff = (() => {

  let _admins = [];
  const PAYMENT_METHODS = ['WeChat Pay','Alipay','Bank Transfer','PayPal','Cash','USDT','Other'];
  const ROLES = ['Owner','Manager','Support','Agent','Reseller'];

  const load = async () => {
    const d = await api(`/admin/admins?adminKey=${encodeURIComponent(Store.adminKey)}`);
    _admins = d && d.admins ? d.admins : [];
    render();
  };

  const render = () => {
    const wrap = document.getElementById('staff-list');
    if (!wrap) return;
    if (!_admins.length) {
      wrap.innerHTML = '<div class="empty">No staff members yet. Add one below.</div>';
      return;
    }
    wrap.innerHTML = _admins.map(a => {
      const methods = (a.paymentMethods||[]).map(m => `<span class="pay-method-chip">${esc(m.method)}${m.detail?`: <span style="font-family:monospace;font-size:.72rem">${esc(m.detail)}</span>`:''}</span>`).join('');
      return `
        <div class="staff-card">
          <div class="staff-card-top">
            <div style="display:flex;align-items:center;gap:.7rem">
              <div class="staff-avatar">${esc(a.name).charAt(0).toUpperCase()}</div>
              <div>
                <div class="staff-name">${esc(a.name)}</div>
                <div class="staff-role">${esc(a.role||'Staff')}</div>
              </div>
            </div>
            <div style="display:flex;gap:.4rem">
              <button class="btn btn-sm" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8" onclick="Staff.openEdit('${esc(a.id)}')">✏ Edit</button>
              <button class="btn btn-sm" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626" onclick="Staff.deleteAdmin('${esc(a.id)}')">🗑</button>
            </div>
          </div>
          <div class="staff-methods">
            <div class="ov-label" style="margin-bottom:.35rem">Payment Methods</div>
            ${methods || '<span style="font-size:.75rem;color:var(--muted)">None added</span>'}
          </div>
          ${a.wechat  ? `<div style="font-size:.73rem;color:var(--muted);margin-top:.35rem">WeChat: <strong>${esc(a.wechat)}</strong></div>` : ''}
          ${a.email   ? `<div style="font-size:.73rem;color:var(--muted)">Email: <strong>${esc(a.email)}</strong></div>` : ''}
        </div>`;
    }).join('');
  };

  const openAdd = () => _showForm(null);
  const openEdit = (id) => {
    const a = _admins.find(a=>a.id===id);
    _showForm(a);
  };

  const _showForm = (a) => {
    const isEdit = !!a;
    const roleOpts = ROLES.map(r=>`<option value="${r}" ${a&&a.role===r?'selected':''}>${r}</option>`).join('');
    const existingMethods = (a&&a.paymentMethods||[]);
    const methodRows = existingMethods.map((m,i)=>`
      <div class="pm-row" id="pm-row-${i}">
        <select class="pm-type">${PAYMENT_METHODS.map(pm=>`<option value="${esc(pm)}" ${pm===m.method?'selected':''}>${esc(pm)}</option>`).join('')}</select>
        <input class="pm-detail" placeholder="Account / ID / number" value="${esc(m.detail||'')}"/>
        <button class="btn btn-sm" style="color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:.2rem .5rem" onclick="this.closest('.pm-row').remove()">×</button>
      </div>`).join('');

    _showModal(`
      <div class="modal-header"><h3>${isEdit?'✏ Edit Staff Member':'➕ Add Staff Member'}</h3></div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>Full Name *</label><input id="sf-name" value="${esc(a&&a.name||'')}"/></div>
          <div class="form-group"><label>Role</label><select id="sf-role">${roleOpts}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>WeChat ID</label><input id="sf-wechat" value="${esc(a&&a.wechat||'')}"/></div>
          <div class="form-group"><label>Email</label><input id="sf-email" type="email" value="${esc(a&&a.email||'')}"/></div>
        </div>
        <div style="margin-top:.8rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
            <label style="margin-bottom:0">💳 Payment Methods</label>
            <button class="btn btn-sm" style="font-size:.72rem" onclick="Staff._addMethodRow()">+ Add Method</button>
          </div>
          <div id="pm-rows">${methodRows}</div>
          ${!existingMethods.length?`<div id="pm-empty-msg" style="font-size:.75rem;color:var(--muted)">No payment methods yet. Click "+ Add Method" to add one.</div>`:''}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-sm" onclick="Staff._closeModal()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="Staff._saveForm('${esc(a&&a.id||'')}')">Save</button>
      </div>`);
  };

  const _addMethodRow = () => {
    const empty = document.getElementById('pm-empty-msg');
    if (empty) empty.remove();
    const container = document.getElementById('pm-rows');
    const i = Date.now();
    const div = document.createElement('div');
    div.className = 'pm-row';
    div.id = `pm-row-${i}`;
    div.innerHTML = `
      <select class="pm-type">${PAYMENT_METHODS.map(pm=>`<option value="${esc(pm)}">${esc(pm)}</option>`).join('')}</select>
      <input class="pm-detail" placeholder="Account / ID / number"/>
      <button class="btn btn-sm" style="color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:.2rem .5rem" onclick="this.closest('.pm-row').remove()">×</button>`;
    container.appendChild(div);
  };

  const _saveForm = async (existingId) => {
    const name   = document.getElementById('sf-name').value.trim();
    const role   = document.getElementById('sf-role').value;
    const wechat = document.getElementById('sf-wechat').value.trim();
    const email  = document.getElementById('sf-email').value.trim();
    if (!name) { alert('Name is required.'); return; }

    const pmRows = [...document.querySelectorAll('.pm-row')];
    const paymentMethods = pmRows.map(row => ({
      method: row.querySelector('.pm-type').value,
      detail: row.querySelector('.pm-detail').value.trim(),
    })).filter(m => m.method);

    const admin = { id: existingId || '', name, role, wechat, email, paymentMethods };
    const d = await api('/admin/admins/save', { adminKey: Store.adminKey, admin });
    _closeModal();
    if (d && d.success) { _admins = d.admins; render(); }
    else alert('✕ Failed: ' + (d&&d.error||'Unknown'));
  };

  const deleteAdmin = async (id) => {
    if (!confirm('Remove this staff member?')) return;
    const d = await api('/admin/admins/delete', { adminKey: Store.adminKey, id });
    if (d && d.success) { _admins = _admins.filter(a=>a.id!==id); render(); }
    else alert('✕ Failed.');
  };

  const _showModal = (html) => {
    let m = document.getElementById('staff-modal-overlay');
    if (!m) { m=document.createElement('div'); m.id='staff-modal-overlay'; m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem'; m.addEventListener('click',e=>{if(e.target===m)_closeModal();}); document.body.appendChild(m); }
    m.innerHTML = `<div class="cust-modal" style="max-width:560px">${html}</div>`;
    m.style.display='flex';
  };
  const _closeModal = () => { const m=document.getElementById('staff-modal-overlay'); if(m) m.style.display='none'; };

  return { load, render, openAdd, openEdit, deleteAdmin, _addMethodRow, _saveForm, _closeModal };
})();
