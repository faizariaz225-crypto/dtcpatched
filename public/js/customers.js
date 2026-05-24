/* ─── DTC Admin — Customers Module (v3) ─────────────────────────────────── */
'use strict';

const Customers = (() => {

  /* ── state ─────────────────────────────────────────────────────────────── */
  let _openCustomerId = null;
  let _activeTab      = 'overview';

  /* ── group tokens by identity ───────────────────────────────────────────── */
  const _groupCustomers = () => {
    const groups = {};
    Object.entries(Store.tokens).forEach(([token, t]) => {
      if (!t.customerName && !t.email && !t.wechat) return;
      const identityKey = (t.email || t.wechat || '').toLowerCase().trim() || token;
      if (!groups[identityKey]) {
        groups[identityKey] = { id: identityKey, displayName: t.customerName || '—', email: t.email || '', wechat: t.wechat || '', tokens: [] };
      }
      if (t.approved || !groups[identityKey].tokens.length) {
        groups[identityKey].displayName = t.customerName || groups[identityKey].displayName;
        groups[identityKey].email       = t.email        || groups[identityKey].email;
        groups[identityKey].wechat      = t.wechat       || groups[identityKey].wechat;
      }
      groups[identityKey].tokens.push({ token, ...t });
    });
    Object.values(groups).forEach(g => {
      g.tokens.sort((a, b) => new Date(b.approvedAt || b.createdAt || 0) - new Date(a.approvedAt || a.createdAt || 0));
    });
    return Object.values(groups);
  };

  const _activeToken = (group) =>
    group.tokens.find(t => t.approved && !t.deactivated && !t.refunded && getSubStatus(t) !== 'expired') ||
    group.tokens.find(t => t.approved && !t.deactivated && !t.refunded) || null;

  /* ── render list ─────────────────────────────────────────────────────────── */
  const render = () => {
    const filter = Store.custFilter;
    const groups = _groupCustomers().filter(g => {
      const active = _activeToken(g);
      if (filter === 'all')      return true;
      if (filter === 'active')   { const st = active && getSubStatus(active); return st === 'ok'; }
      if (filter === 'expiring') { const st = active && getSubStatus(active); return st === 'soon' || st === 'danger'; }
      if (filter === 'expired')  { const st = active && getSubStatus(active); return st === 'expired' || (!active && g.tokens.some(t => t.approved)); }
      return true;
    });

    const allGroups = _groupCustomers();
    const expiring  = allGroups.filter(g => { const a = _activeToken(g); if (!a) return false; const d = daysUntil(a.subscriptionExpiresAt || '9999'); return d >= 0 && d <= 30; }).length;
    const nb = document.getElementById('nb-exp');
    if (nb) { nb.textContent = expiring; nb.style.display = expiring > 0 ? '' : 'none'; }

    const wrap = document.getElementById('cust-list');
    if (!groups.length) { wrap.innerHTML = '<div class="empty">No customers match this filter.</div>'; return; }
    wrap.innerHTML = groups.map(g => _row(g)).join('');
    if (_openCustomerId) {
      const still = groups.find(g => g.id === _openCustomerId);
      if (still) _openPanel(still, false);
    }
  };

  /* ── row ─────────────────────────────────────────────────────────────────── */
  const _row = (g) => {
    const active  = _activeToken(g);
    const subSt   = active ? getSubStatus(active) : null;
    const days    = active && active.subscriptionExpiresAt ? daysUntil(active.subscriptionExpiresAt) : null;
    const statusBadgeHtml =
      !active             ? `<span class="badge b-deact">⊘ No Active Sub</span>` :
      subSt === 'expired' ? `<span class="badge b-exp">✕ Expired</span>` :
      subSt === 'danger'  ? `<span class="badge" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626">⚠ ${days}d left</span>` :
      subSt === 'soon'    ? `<span class="badge" style="background:#fffbeb;border:1px solid #fde68a;color:#d97706">⏰ ${days}d left</span>` :
                            `<span class="badge b-act">✓ Active · ${days}d left</span>`;
    const prodTag = active ? (active.product === 'chatgpt' ? `<span class="prod-tag prod-chatgpt">ChatGPT+</span>` : `<span class="prod-tag prod-claude">Claude Pro</span>`) : '';
    const totalSubs = g.tokens.filter(t => t.approved).length;
    const isOpen    = _openCustomerId === g.id;
    return `
      <div class="cust-row ${isOpen?'cust-row--open':''}" id="crow-${CSS.escape(g.id)}" onclick="Customers.togglePanel(${JSON.stringify(g.id)},event)">
        <div class="crow-main">
          <div class="crow-left">
            <div class="crow-avatar">${esc(g.displayName).charAt(0).toUpperCase()}</div>
            <div class="crow-info">
              <div class="crow-name">${esc(g.displayName)}</div>
              <div class="crow-meta">${esc(g.email || g.wechat || '—')}</div>
            </div>
          </div>
          <div class="crow-right">
            ${prodTag}
            ${statusBadgeHtml}
            <span class="crow-subs-count">${totalSubs} sub${totalSubs!==1?'s':''}</span>
            <div class="crow-chevron ${isOpen?'open':''}">▾</div>
          </div>
        </div>
        <div class="cust-panel" id="cpanel-${CSS.escape(g.id)}" style="display:${isOpen?'block':'none'}"></div>
      </div>`;
  };

  /* ── panel open/close ────────────────────────────────────────────────────── */
  const togglePanel = (id, event) => {
    if (event && event.target.closest('button,a,input,select,textarea')) return;
    if (_openCustomerId === id) { _closePanel(id); }
    else { if (_openCustomerId) _closePanel(_openCustomerId); const g = _groupCustomers().find(g=>g.id===id); if(g) _openPanel(g,true); }
  };
  const _closePanel = (id) => {
    _openCustomerId = null; _activeTab = 'overview';
    const row = document.getElementById('crow-'+CSS.escape(id)); if(!row)return;
    row.classList.remove('cust-row--open');
    row.querySelector('.crow-chevron').classList.remove('open');
    const panel = document.getElementById('cpanel-'+CSS.escape(id)); if(panel) panel.style.display='none';
  };
  const _openPanel = (group, animate) => {
    _openCustomerId = group.id;
    const row = document.getElementById('crow-'+CSS.escape(group.id)); if(!row)return;
    row.classList.add('cust-row--open');
    row.querySelector('.crow-chevron').classList.add('open');
    const panel = document.getElementById('cpanel-'+CSS.escape(group.id)); if(!panel)return;
    panel.innerHTML = _renderPanel(group);
    panel.style.display = 'block';
    if(animate) row.scrollIntoView({behavior:'smooth',block:'nearest'});
  };

  /* ── panel ───────────────────────────────────────────────────────────────── */
  const _renderPanel = (g) => {
    const tabs = [
      {id:'overview',label:'👤 Overview'},
      {id:'active',label:'✓ Active'},
      {id:'history',label:'📋 History'},
      {id:'declined',label:'✕ Declined'},
      {id:'refunded',label:'↩ Refunded'},
    ];
    const tabNav = tabs.map(tab => `<button class="ptab ${_activeTab===tab.id?'ptab--active':''}" onclick="Customers._setTab(${JSON.stringify(g.id)},'${tab.id}',event)">${tab.label}</button>`).join('');
    return `
      <div class="cust-panel-inner" onclick="event.stopPropagation()">
        <div class="panel-actions-top">
          <button class="btn btn-sm" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8"
                  onclick="Customers.openEditCustomer(${JSON.stringify(g.id)},event)">✏ Edit Customer</button>
          <button class="btn btn-sm" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626;margin-left:.4rem"
                  onclick="Customers.deleteCustomer(${JSON.stringify(g.id)},event)">🗑 Delete</button>
        </div>
        <div class="ptab-nav">${tabNav}</div>
        <div class="ptab-body" id="ptab-body-${CSS.escape(g.id)}">${_renderTab(g,_activeTab)}</div>
      </div>`;
  };

  /* ── tabs ────────────────────────────────────────────────────────────────── */
  const _setTab = (id, tab, event) => {
    if(event) event.stopPropagation();
    _activeTab = tab;
    const groups = _groupCustomers();
    const group  = groups.find(g=>g.id===id); if(!group) return;
    const panel  = document.getElementById('cpanel-'+CSS.escape(id)); if(!panel) return;
    panel.querySelectorAll('.ptab').forEach(b=>b.classList.remove('ptab--active'));
    const labels = {overview:'Overview',active:'Active',history:'History',declined:'Declined',refunded:'Refunded'};
    const ab = [...panel.querySelectorAll('.ptab')].find(b=>b.textContent.includes(labels[tab]));
    if(ab) ab.classList.add('ptab--active');
    const body = document.getElementById('ptab-body-'+CSS.escape(id));
    if(body) body.innerHTML = _renderTab(group, tab);
  };

  const _renderTab = (g, tab) => {
    if(tab==='overview') return _tabOverview(g);
    if(tab==='active')   return _tabActive(g);
    if(tab==='history')  return _tabHistory(g);
    if(tab==='declined') return _tabDeclined(g);
    if(tab==='refunded') return _tabRefunded(g);
    return '';
  };

  /* ── tab: overview ───────────────────────────────────────────────────────── */
  const _tabOverview = (g) => {
    const active     = _activeToken(g);
    const totalSubs  = g.tokens.filter(t=>t.approved).length;
    const firstSub   = [...g.tokens].reverse().find(t=>t.approvedAt);
    const totalSpend = g.tokens.filter(t=>t.approved&&t.price).reduce((s,t)=>s+(t.price||0),0);
    return `
      <div class="overview-grid">
        <div class="ov-card"><div class="ov-label">Full Name</div><div class="ov-val">${esc(g.displayName)}</div></div>
        <div class="ov-card"><div class="ov-label">Email</div><div class="ov-val">${esc(g.email||'—')}</div></div>
        <div class="ov-card"><div class="ov-label">WeChat</div><div class="ov-val">${esc(g.wechat||'—')}</div></div>
        <div class="ov-card"><div class="ov-label">Subscriptions</div><div class="ov-val">${totalSubs}</div></div>
        <div class="ov-card"><div class="ov-label">Total Spent</div><div class="ov-val">$${totalSpend.toFixed(2)}</div></div>
        <div class="ov-card"><div class="ov-label">Customer Since</div><div class="ov-val">${firstSub?new Date(firstSub.approvedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—'}</div></div>
      </div>
      ${active ? `<div style="margin-top:1rem"><div class="section-label">Current Subscription</div>${_subCard(active,g,true)}</div>` :
        `<div class="empty-tab">No active subscription.<button class="btn btn-sm btn-primary" style="margin-top:.6rem" onclick="Customers.reactivate(${JSON.stringify(g.id)},event)">⟳ Reactivate</button></div>`}`;
  };

  /* ── tab: active ─────────────────────────────────────────────────────────── */
  const _tabActive = (g) => {
    const active = _activeToken(g);
    if(!active) return `<div class="empty-tab">No active subscription.<button class="btn btn-sm btn-primary" style="margin-top:.6rem" onclick="Customers.reactivate(${JSON.stringify(g.id)},event)">⟳ Reactivate</button></div>`;
    return `
      <div class="section-label">Active Subscription</div>
      ${_subCard(active,g,true)}
      <div class="sub-actions">
        <button class="btn btn-sm" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8"
                onclick="Customers.openEditSubscription('${esc(active.token)}',${JSON.stringify(g.id)},event)">✏ Edit Subscription</button>
        <button class="btn btn-sm btn-primary" onclick="Customers.reactivate(${JSON.stringify(g.id)},event)">⟳ Reactivate (New Link)</button>
        <button class="btn btn-sm" style="border:1px solid var(--warn-border);color:#d97706;background:var(--warn-bg)"
                onclick="Customers.sendReminder('${esc(active.token)}','reminder')">📧 5-day Reminder</button>
        <button class="btn btn-sm" style="border:1px solid var(--error-border);color:var(--error);background:var(--error-bg)"
                onclick="Customers.sendReminder('${esc(active.token)}','expired')">📧 Expiry Notice</button>
        <button class="btn btn-sm" style="border:1px solid #fecaca;color:#dc2626;background:#fef2f2"
                onclick="Customers.refundToken('${esc(active.token)}',${JSON.stringify(g.id)},event)">↩ Mark Refunded</button>
      </div>`;
  };

  /* ── tab: history ────────────────────────────────────────────────────────── */
  const _tabHistory = (g) => {
    const approved = g.tokens.filter(t=>t.approved&&!t.declined&&!t.refunded);
    if(!approved.length) return '<div class="empty-tab">No subscription history yet.</div>';
    return approved.map(t=>`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
        ${_subCard(t,g,false)}
      </div>
      <div style="display:flex;gap:.4rem;margin-bottom:.8rem;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8"
                onclick="Customers.openEditSubscription('${esc(t.token)}',${JSON.stringify(g.id)},event)">✏ Edit</button>
      </div>`).join('');
  };

  /* ── tab: declined ───────────────────────────────────────────────────────── */
  const _tabDeclined = (g) => {
    const declined = g.tokens.filter(t=>t.declined);
    if(!declined.length) return '<div class="empty-tab">No declined requests.</div>';
    return declined.map(t=>`
      <div class="sub-card sub-card--declined">
        <div class="sc-row"><span class="badge b-dec">✕ Declined</span><span class="sc-date">${t.declinedAt?new Date(t.declinedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—'}</span></div>
        <div class="sc-row sc-muted">Reason: ${esc(t.declineReason||'No reason given')}</div>
        <div class="sc-row sc-muted">Package: ${esc(t.packageType||'—')}</div>
      </div>`).join('');
  };

  /* ── tab: refunded ───────────────────────────────────────────────────────── */
  const _tabRefunded = (g) => {
    const refunded = g.tokens.filter(t=>t.refunded);
    if(!refunded.length) return '<div class="empty-tab">No refunded subscriptions.</div>';
    return refunded.map(t=>`
      <div class="sub-card sub-card--refunded">
        <div class="sc-row"><span class="badge" style="background:#fef9f0;border:1px solid #fde68a;color:#92400e">↩ Refunded</span><span class="sc-date">${t.refundedAt?new Date(t.refundedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—'}</span></div>
        <div class="sc-row sc-muted">Package: ${esc(t.packageType||'—')} · $${(t.price||0).toFixed(2)}</div>
        ${t.refundNote?`<div class="sc-row sc-muted">Note: ${esc(t.refundNote)}</div>`:''}
      </div>`).join('');
  };

  /* ── subscription card ───────────────────────────────────────────────────── */
  const _subCard = (t, g, isActive) => {
    const subSt   = getSubStatus(t);
    const days    = t.subscriptionExpiresAt ? daysUntil(t.subscriptionExpiresAt) : null;
    const total   = t.subscriptionDays || 30;
    const pct     = Math.min(100,Math.max(0,((total-(days||0))/total)*100));
    const barColor= subSt==='expired'||subSt==='danger'?'#dc2626':subSt==='soon'?'#d97706':'#16a34a';
    const dCls    = subSt==='expired'||subSt==='danger'?'red':subSt==='soon'?'warn':'green';
    const expDate = t.subscriptionExpiresAt?new Date(t.subscriptionExpiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}):'—';
    const prodTag = t.product==='chatgpt'?`<span class="prod-tag prod-chatgpt">ChatGPT+</span>`:`<span class="prod-tag prod-claude">Claude Pro</span>`;
    const subKeyBadge = t.subscriptionKey
      ? `<span class="sub-key-badge" title="Subscription Key">🔑 ${esc(t.subscriptionKey)}</span>`
      : `<span class="sub-key-badge sub-key-missing" title="No key assigned">🔑 No key</span>`;
    const dataRow = t.product==='chatgpt'
      ? `<div><div class="cf-lbl">Session Data</div><div style="display:flex;gap:.3rem"><button class="icopy btn-sm" style="color:var(--gpt)" onclick="Modals.viewSession('${esc(t.token)}')">View</button><button class="icopy btn-sm" onclick="copyText(${JSON.stringify(t.sessionData||'')},this)">Copy</button></div></div>`
      : `<div><div class="cf-lbl">Org ID</div><div style="display:flex;align-items:flex-start;gap:.3rem"><div class="cf-val" style="flex:1">${esc((t.orgId||'—').slice(0,22))}…</div>${t.orgId?`<button class="icopy btn-sm" onclick="copyText('${esc(t.orgId)}',this)">Copy</button>`:''}</div></div>`;
    return `
      <div class="sub-card ${isActive?'sub-card--active':''}">
        <div class="sc-row" style="margin-bottom:.5rem;flex-wrap:wrap;gap:.3rem">
          ${prodTag}<span class="sc-pkg">${esc(t.packageType||'—')}</span>
          ${subKeyBadge}
          ${isActive?'<span class="badge b-act" style="margin-left:auto">Active</span>':''}
        </div>
        <div class="cust-grid" style="margin-bottom:.5rem">
          ${dataRow}
          <div><div class="cf-lbl">Activated</div><div class="cf-val">${t.approvedAt?new Date(t.approvedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—'}</div></div>
          <div><div class="cf-lbl">Expires</div><div class="cf-val ${dCls}">${expDate}</div></div>
          <div><div class="cf-lbl">Days Left</div><div class="cf-val ${dCls}">${days===null?'—':days<=0?'Expired':days+' days'}</div></div>
          <div><div class="cf-lbl">Price</div><div class="cf-val">$${(t.price||0).toFixed(2)}</div></div>
        </div>
        ${days!==null?`<div class="exp-bar-wrap"><div class="exp-bar-label"><span>Usage</span><span style="font-weight:600">${Math.round(pct)}% used</span></div><div class="exp-bar"><div class="exp-bar-fill" style="width:${pct}%;background:${barColor}"></div></div></div>`:''}
      </div>`;
  };

  /* ══════════════════════════════════════════════════════════
     EDIT CUSTOMER MODAL
  ══════════════════════════════════════════════════════════ */
  const openEditCustomer = (id, event) => {
    if(event) event.stopPropagation();
    const g = _groupCustomers().find(g=>g.id===id); if(!g) return;
    _showModal(`
      <div class="modal-header"><h3>✏ Edit Customer</h3></div>
      <div class="modal-body">
        <div class="form-group"><label>Full Name</label><input id="ec-name" value="${esc(g.displayName)}"/></div>
        <div class="form-group"><label>Email</label><input id="ec-email" type="email" value="${esc(g.email)}"/></div>
        <div class="form-group"><label>WeChat ID</label><input id="ec-wechat" value="${esc(g.wechat)}"/></div>
        <div class="modal-note">Changes will apply to ALL tokens belonging to this customer.</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-sm" onclick="Customers._closeModal()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="Customers._saveEditCustomer(${JSON.stringify(id)})">Save Changes</button>
      </div>`);
  };

  const _saveEditCustomer = async (id) => {
    const name   = document.getElementById('ec-name').value.trim();
    const email  = document.getElementById('ec-email').value.trim();
    const wechat = document.getElementById('ec-wechat').value.trim();
    if(!name) { alert('Name is required.'); return; }
    const g = _groupCustomers().find(g=>g.id===id); if(!g) return;
    let failed=0;
    for(const t of g.tokens) {
      const d = await api('/admin/edit-token', { adminKey: Store.adminKey, token: t.token, customerName: name, email, wechat });
      if(!d||!d.success) failed++;
    }
    _closeModal();
    if(failed) alert(`⚠ ${failed} token(s) failed to update.`);
    else alert('✓ Customer updated.');
    await Dashboard.reload();
  };

  /* ══════════════════════════════════════════════════════════
     EDIT SUBSCRIPTION MODAL
  ══════════════════════════════════════════════════════════ */
  const openEditSubscription = async (token, customerId, event) => {
    if(event) event.stopPropagation();
    const groups = _groupCustomers();
    const g      = groups.find(g=>g.id===customerId); if(!g) return;
    const t      = g.tokens.find(t=>t.token===token); if(!t) return;

    // Fetch available keys for this product
    const keysData = await api(`/admin/keys?adminKey=${encodeURIComponent(Store.adminKey)}&product=${encodeURIComponent(t.product||'claude')}`);
    const unusedKeys = (keysData&&keysData.keys ? keysData.keys.filter(k=>!k.usedBy) : []);
    const unusedOpts = unusedKeys.map(k=>`<option value="${esc(k.key)}" ${t.subscriptionKey===k.key?'selected':''}>${esc(k.key)}</option>`).join('');
    const currentKeyOpt = t.subscriptionKey && !unusedKeys.find(k=>k.key===t.subscriptionKey)
      ? `<option value="${esc(t.subscriptionKey)}" selected>${esc(t.subscriptionKey)} (current)</option>` : '';

    const expVal = t.subscriptionExpiresAt ? t.subscriptionExpiresAt.slice(0,16) : '';
    const approvedVal = t.approvedAt ? t.approvedAt.slice(0,16) : '';

    _showModal(`
      <div class="modal-header"><h3>✏ Edit Subscription</h3></div>
      <div class="modal-body">
        <div class="form-group">
          <label>Package / Plan</label>
          <input id="es-pkg" value="${esc(t.packageType||'')}"/>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Activation Date</label>
            <input id="es-approved" type="datetime-local" value="${approvedVal}"/>
          </div>
          <div class="form-group">
            <label>Expiry Date &amp; Time</label>
            <input id="es-expiry" type="datetime-local" value="${expVal}"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Price ($)</label>
            <input id="es-price" type="number" min="0" step="0.01" value="${(t.price||0).toFixed(2)}"/>
          </div>
          <div class="form-group">
            <label>Duration Days</label>
            <input id="es-days" type="number" min="1" step="1" value="${t.subscriptionDays||30}"/>
          </div>
        </div>
        <div class="form-group">
          <label>Subscription Key 🔑
            <span style="font-size:.65rem;color:var(--muted);font-weight:400;margin-left:.3rem">
              (leave empty to keep current)
            </span>
          </label>
          <div style="display:flex;gap:.5rem;align-items:flex-start">
            <div style="flex:1">
              <input id="es-key-manual" placeholder="Type a key manually or pick unused below" value="${esc(t.subscriptionKey||'')}"/>
              ${unusedKeys.length?`<select id="es-key-select" style="margin-top:.4rem;width:100%" onchange="document.getElementById('es-key-manual').value=this.value">
                <option value="">— Pick from unused keys —</option>
                ${currentKeyOpt}${unusedOpts}
              </select>`:'<div style="font-size:.72rem;color:var(--muted);margin-top:.3rem">No unused keys available for this product. <a href="#" onclick="Shell.navigate(\'keys\',null);Customers._closeModal()">Add keys in Keys section →</a></div>'}
            </div>
          </div>
        </div>
        <div class="modal-note">Changing the expiry date directly updates the customer's subscription timeline.</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-sm" onclick="Customers._closeModal()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="Customers._saveEditSubscription('${esc(token)}',${JSON.stringify(customerId)})">Save Changes</button>
      </div>`);
  };

  const _saveEditSubscription = async (token, customerId) => {
    const pkg     = document.getElementById('es-pkg').value.trim();
    const expiry  = document.getElementById('es-expiry').value;
    const approved= document.getElementById('es-approved').value;
    const price   = parseFloat(document.getElementById('es-price').value)||0;
    const days    = parseInt(document.getElementById('es-days').value)||30;
    const subKey  = document.getElementById('es-key-manual').value.trim();

    if(!pkg)    { alert('Package name is required.'); return; }
    if(!expiry) { alert('Expiry date is required.'); return; }

    const d = await api('/admin/edit-token', {
      adminKey: Store.adminKey,
      token,
      packageType:          pkg,
      subscriptionExpiresAt: new Date(expiry).toISOString(),
      approvedAt:           approved ? new Date(approved).toISOString() : undefined,
      price,
      subscriptionDays:     days,
      subscriptionKey:      subKey || undefined,
    });

    _closeModal();
    if(d&&d.success) { await Dashboard.reload(); }
    else alert('✕ Failed: '+(d&&d.error||'Unknown error'));
  };

  /* ══════════════════════════════════════════════════════════
     ACTIONS
  ══════════════════════════════════════════════════════════ */
  const setFilter = (f, btn) => {
    Store.setCustFilter(f);
    document.querySelectorAll('#cf .fb').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    render();
  };

  const sendReminder = async (token, type) => {
    const d = await api('/admin/send-reminder',{adminKey:Store.adminKey,token,type});
    alert(d&&d.ok?'✓ Email sent.':'✕ Failed: '+(d&&d.error));
    if(d&&d.ok) Dashboard.reload();
  };

  const deleteCustomer = async (id, event) => {
    if(event) event.stopPropagation();
    const g = _groupCustomers().find(g=>g.id===id); if(!g) return;
    if(!confirm(`Delete customer "${g.displayName}"?\n\nAll ${g.tokens.length} token(s) will be soft-deleted.`)) return;
    let failed=0;
    for(const t of g.tokens) { const d=await api('/admin/delete-token',{adminKey:Store.adminKey,token:t.token}); if(!d||!d.success) failed++; }
    _openCustomerId=null;
    if(failed) alert(`⚠ ${failed} token(s) failed.`); else alert(`✓ Customer deleted.`);
    await Dashboard.reload();
  };

  const reactivate = async (id, event) => {
    if(event) event.stopPropagation();
    const g   = _groupCustomers().find(g=>g.id===id); if(!g) return;
    const ref = g.tokens.find(t=>t.approved)||g.tokens[0];
    if(!ref) { alert('No previous subscription found.'); return; }

    // Fetch available keys for this product
    const keysData = await api(`/admin/keys?adminKey=${encodeURIComponent(Store.adminKey)}&product=${encodeURIComponent(ref.product||'claude')}`);
    const unusedKeys = keysData&&keysData.keys ? keysData.keys.filter(k=>!k.usedBy) : [];
    const unusedOpts = unusedKeys.map(k=>`<option value="${esc(k.key)}">${esc(k.key)}</option>`).join('');

    _showModal(`
      <div class="modal-header"><h3>⟳ Reactivate Customer</h3></div>
      <div class="modal-body">
        <div class="modal-note" style="margin-bottom:.8rem">
          A new activation link will be created for <strong>${esc(g.displayName)}</strong>
          using their last package: <strong>${esc(ref.packageType||'Unknown')}</strong>.
          All history is preserved.
        </div>
        <div class="form-group">
          <label>Subscription Key 🔑 <span style="font-size:.65rem;color:var(--muted);font-weight:400">(required)</span></label>
          <input id="ra-key-manual" placeholder="Enter or pick a key"/>
          ${unusedKeys.length?`<select style="margin-top:.4rem;width:100%" onchange="document.getElementById('ra-key-manual').value=this.value">
            <option value="">— Pick from unused keys —</option>
            ${unusedOpts}
          </select>`:`<div style="font-size:.72rem;color:var(--muted);margin-top:.3rem">No unused keys. <a href="#" onclick="Shell.navigate('keys',null);Customers._closeModal()">Add keys →</a></div>`}
        </div>
        <div class="form-group"><label>Override Price ($) <span style="font-size:.65rem;color:var(--muted)">(optional)</span></label>
          <input id="ra-price" type="number" min="0.01" step="0.01" value="${(ref.price||0).toFixed(2)}"/>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-sm" onclick="Customers._closeModal()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="Customers._doReactivate(${JSON.stringify(id)},${JSON.stringify(ref)})">Generate New Link</button>
      </div>`);
  };

  const _doReactivate = async (id, ref) => {
    const subKey = document.getElementById('ra-key-manual').value.trim();
    const price  = parseFloat(document.getElementById('ra-price').value)||ref.price||0;
    if(!subKey) { alert('A subscription key is required.'); return; }

    const d = await api('/admin/generate',{
      adminKey:Store.adminKey, customerName: _groupCustomers().find(g=>g.id===id)?.displayName||ref.customerName,
      productId:ref.productId, packageLabel:ref.packageType, price,
      instructionSetId:ref.instructionSetId||'', postInstructionSetId:ref.postInstructionSetId||'',
      resellerId:ref.resellerId||'', resellerName:ref.resellerName||'',
      subscriptionKey: subKey,
    });

    _closeModal();
    if(d&&d.link) {
      _showModal(`
        <div class="modal-header"><h3>✓ New Link Created</h3></div>
        <div class="modal-body">
          <div class="modal-note" style="margin-bottom:.8rem">Share this link with the customer via WeChat or email.</div>
          <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:.8rem 1rem;font-family:monospace;font-size:.82rem;word-break:break-all">${d.link}</div>
          <button class="btn btn-sm btn-primary" style="margin-top:.6rem" onclick="copyText(${JSON.stringify(d.link)},this)">Copy Link</button>
          ${subKey?`<div style="margin-top:.7rem;font-size:.8rem;color:var(--muted)">🔑 Key assigned: <strong>${esc(subKey)}</strong></div>`:''}
        </div>
        <div class="modal-footer"><button class="btn btn-sm btn-primary" onclick="Customers._closeModal();Dashboard.reload()">Done</button></div>`);
    } else {
      alert('✕ Failed: '+(d&&d.error||'Unknown error'));
    }
  };

  const refundToken = async (token, customerId, event) => {
    if(event) event.stopPropagation();
    const note = prompt('Optional refund note:');
    if(note===null) return;
    const d = await api('/admin/refund',{adminKey:Store.adminKey,token,refundNote:note});
    if(d&&d.success) { alert('✓ Marked as refunded.'); await Dashboard.reload(); }
    else alert('✕ Failed: '+(d&&d.error||'Unknown error'));
  };

  /* ── modal helper ────────────────────────────────────────────────────────── */
  const _showModal = (html) => {
    let m = document.getElementById('cust-modal-overlay');
    if(!m) {
      m = document.createElement('div');
      m.id = 'cust-modal-overlay';
      m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
      m.addEventListener('click', e=>{ if(e.target===m) _closeModal(); });
      document.body.appendChild(m);
    }
    m.innerHTML = `<div class="cust-modal">${html}</div>`;
    m.style.display = 'flex';
  };
  const _closeModal = () => {
    const m = document.getElementById('cust-modal-overlay');
    if(m) m.style.display = 'none';
  };

  return { render, setFilter, sendReminder, togglePanel, _setTab, deleteCustomer, reactivate, _doReactivate, refundToken, openEditCustomer, _saveEditCustomer, openEditSubscription, _saveEditSubscription, _closeModal };
})();
