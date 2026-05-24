/* ─── DTC Admin — Users Module ───────────────────────────────────────────── */
'use strict';

const Users = (() => {

  let _users    = [];
  let _sessions = [];

  const ROLES = [
    { id: 'superadmin', label: 'Super Admin',  desc: 'Full access to everything, including user management' },
    { id: 'admin',      label: 'Admin',         desc: 'All sections except creating superadmin accounts' },
    { id: 'manager',    label: 'Manager',        desc: 'Dashboard, customers, keys, payments, staff, revenue' },
    { id: 'agent',      label: 'Agent',          desc: 'Dashboard, customers, keys, payments only' },
    { id: 'viewer',     label: 'Viewer',         desc: 'Dashboard and customers — read-only view' },
  ];

  const ROLE_PERMS = {
    superadmin: ['all'],
    admin:      ['dashboard','customers','keys','payments','staff','revenue','resellers','products','instructions','notifications','settings','campaigns','email'],
    manager:    ['dashboard','customers','keys','payments','staff','revenue','resellers'],
    agent:      ['dashboard','customers','keys','payments'],
    viewer:     ['dashboard','customers','revenue'],
  };

  const ALL_SECTIONS = [
    { id: 'dashboard',     label: 'Dashboard' },
    { id: 'customers',     label: 'Customers' },
    { id: 'keys',          label: 'Keys' },
    { id: 'payments',      label: 'Payments' },
    { id: 'staff',         label: 'Staff' },
    { id: 'revenue',       label: 'Revenue' },
    { id: 'resellers',     label: 'Resellers' },
    { id: 'products',      label: 'Products' },
    { id: 'instructions',  label: 'Instructions' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'settings',      label: 'Settings' },
    { id: 'campaigns',     label: 'Campaigns' },
    { id: 'email',         label: 'Email' },
  ];

  /* ── load ─────────────────────────────────────────────────────────────── */
  const load = async () => {
    const [ud, sd] = await Promise.all([
      api(`/admin/users?adminKey=${encodeURIComponent(Store.adminKey)}`),
      api(`/admin/users/sessions?adminKey=${encodeURIComponent(Store.adminKey)}`),
    ]);
    _users    = ud && ud.users    ? ud.users    : [];
    _sessions = sd && sd.sessions ? sd.sessions : [];
    render();
  };

  /* ── render ───────────────────────────────────────────────────────────── */
  const render = () => {
    const wrap = document.getElementById('users-page');
    if (!wrap) return;
    const me = Store.currentUser;

    const roleColors = { superadmin:'#534AB7', admin:'#185FA5', manager:'#1D9E75', agent:'#BA7517', viewer:'#5F5E5A' };

    const userCards = _users.map(u => {
      const color = roleColors[u.role] || '#5563eb';
      const roleInfo = ROLES.find(r=>r.id===u.role);
      const isMe = me && me.id === u.id;
      const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : 'Never';
      const canEdit = me && (me.role==='superadmin' || (me.role==='admin' && u.role!=='superadmin'));
      const activeSessions = _sessions.filter(s=>s.userId===u.id);

      return `
        <div class="user-card ${!u.active?'user-card--inactive':''}">
          <div class="user-card-top">
            <div style="display:flex;align-items:center;gap:.7rem">
              <div class="user-avatar" style="background:${color}">${(u.name||'?').charAt(0).toUpperCase()}</div>
              <div>
                <div style="display:flex;align-items:center;gap:.4rem">
                  <span class="user-name">${esc(u.name)}</span>
                  ${isMe?`<span style="font-size:.62rem;background:#eff6ff;border:0.5px solid #bfdbfe;color:#1d4ed8;border-radius:4px;padding:1px 5px">you</span>`:''}
                  ${!u.active?`<span style="font-size:.62rem;background:#fef2f2;border:0.5px solid #fecaca;color:#dc2626;border-radius:4px;padding:1px 5px">inactive</span>`:''}
                </div>
                <div class="user-meta">@${esc(u.username)} · <span style="color:${color}">${esc(roleInfo?roleInfo.label:u.role)}</span></div>
              </div>
            </div>
            <div style="display:flex;gap:.4rem;align-items:center">
              ${activeSessions.length?`<span style="font-size:.65rem;background:#f0fdf4;border:0.5px solid #bbf7d0;color:#15803d;border-radius:4px;padding:2px 6px">● Online</span>`:''}
              ${canEdit?`<button class="btn btn-sm" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8" onclick="Users.openEdit('${esc(u.id)}')">✏ Edit</button>`:''}
              ${canEdit&&!isMe?`<button class="btn btn-sm" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626" onclick="Users.deleteUser('${esc(u.id)}')">🗑</button>`:''}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem .8rem;font-size:.72rem;margin-top:.5rem">
            <div><span style="color:var(--muted)">Last login: </span><strong>${lastLogin}</strong></div>
            <div><span style="color:var(--muted)">Sessions: </span><strong>${activeSessions.length} active</strong></div>
            <div><span style="color:var(--muted)">Created: </span><strong>${u.createdAt?new Date(u.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—'}</strong></div>
          </div>
          <div class="user-perms">
            ${_permBadges(u)}
          </div>
          ${canEdit&&activeSessions.length?`<button class="btn btn-sm" style="font-size:.68rem;margin-top:.4rem;border:1px solid #fecaca;color:#dc2626;background:#fef2f2" onclick="Users.revokeSessions('${esc(u.id)}','${esc(u.name)}')">⊘ Revoke Active Sessions</button>`:''}
        </div>`;
    }).join('');

    const sessionRows = _sessions.map(s => `
      <tr>
        <td><strong>${esc(s.userName)}</strong></td>
        <td><span style="font-size:.68rem;background:#eff6ff;border:0.5px solid #bfdbfe;color:#1d4ed8;border-radius:4px;padding:2px 6px;text-transform:capitalize">${esc(s.role)}</span></td>
        <td style="font-family:monospace;font-size:.72rem;color:var(--muted)">${esc(s.ip)}</td>
        <td>${s.lastSeen?new Date(s.lastSeen).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
      </tr>`).join('');

    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
        <div></div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-sm" onclick="Users.load()">↻ Refresh</button>
          ${me&&(me.role==='superadmin'||me.role==='admin')?`<button class="btn btn-primary btn-sm" onclick="Users.openAdd()">+ Add User</button>`:''}
        </div>
      </div>

      <div class="stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:1.2rem">
        <div class="stat"><div class="stat-val">${_users.length}</div><div class="stat-lbl">Total Users</div></div>
        <div class="stat"><div class="stat-val sv-green">${_users.filter(u=>u.active).length}</div><div class="stat-lbl">Active</div></div>
        <div class="stat"><div class="stat-val sv-blue">${_sessions.length}</div><div class="stat-lbl">Online Now</div></div>
        <div class="stat"><div class="stat-val sv-warn">${_users.filter(u=>!u.active).length}</div><div class="stat-lbl">Inactive</div></div>
      </div>

      <div class="user-cards">${userCards||'<div class="empty">No users found.</div>'}</div>

      ${_sessions.length?`
        <div class="card" style="margin-top:1.2rem">
          <div class="card-title" style="margin-bottom:.7rem">● Active Sessions (${_sessions.length})</div>
          <div style="overflow-x:auto">
            <table class="keys-table">
              <thead><tr><th>User</th><th>Role</th><th>IP Address</th><th>Last Seen</th></tr></thead>
              <tbody>${sessionRows}</tbody>
            </table>
          </div>
          ${me&&(me.role==='superadmin'||me.role==='admin')?`<button class="btn btn-sm" style="margin-top:.6rem;border:1px solid #fecaca;color:#dc2626;background:#fef2f2" onclick="Users.revokeAllSessions()">⊘ Revoke All Sessions</button>`:''}
        </div>` : ''}`;
  };

  const _permBadges = (u) => {
    const perms = u.permissions || ROLE_PERMS[u.role] || [];
    if (perms.includes('all')) return `<span class="perm-badge perm-all">All Access</span>`;
    return ALL_SECTIONS.filter(s=>perms.includes(s.id)).map(s=>`<span class="perm-badge">${s.label}</span>`).join('');
  };

  /* ── open add/edit modal ──────────────────────────────────────────────── */
  const openAdd  = () => _showForm(null);
  const openEdit = (id) => { const u = _users.find(u=>u.id===id); _showForm(u); };

  const _showForm = (u) => {
    const isEdit   = !!u;
    const me       = Store.currentUser;
    const myRole   = me?.role;
    const availableRoles = ROLES.filter(r => myRole==='superadmin' ? true : r.id!=='superadmin');
    const currentPerms   = u?.permissions || ROLE_PERMS[u?.role||'agent'] || [];

    const roleOpts = availableRoles.map(r => `
      <option value="${r.id}" ${u&&u.role===r.id?'selected':''}>${r.label} — ${r.desc}</option>`).join('');

    const permChecks = ALL_SECTIONS.map(s => `
      <label style="display:flex;align-items:center;gap:.4rem;font-size:.75rem;cursor:pointer;padding:.15rem 0">
        <input type="checkbox" id="up-${s.id}" ${currentPerms.includes('all')||currentPerms.includes(s.id)?'checked':''} style="cursor:pointer"/>
        ${s.label}
      </label>`).join('');

    _showModal(`
      <div class="modal-header"><h3>${isEdit?`✏ Edit — ${esc(u.name)}`:'➕ Add New User'}</h3></div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>Full Name *</label><input id="uf-name" value="${esc(u?.name||'')}"/></div>
          <div class="form-group"><label>Username *</label><input id="uf-username" value="${esc(u?.username||'')}" ${isEdit?'readonly style="opacity:.6"':''}/></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>${isEdit?'New Password':'Password *'} <span style="font-size:.62rem;color:var(--muted)">${isEdit?'(leave blank to keep current)':''}</span></label>
            <input type="password" id="uf-password" placeholder="${isEdit?'New password (optional)':'Min 6 characters'}"/>
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" id="uf-confirm" placeholder="Repeat password"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="grid-column:1/-1">
            <label>Role</label>
            <select id="uf-role" onchange="Users._onRoleChange()">${roleOpts}</select>
          </div>
        </div>
        ${isEdit?`<div class="form-group" style="margin-bottom:.6rem"><label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" id="uf-active" ${u.active?'checked':''}/> Account Active</label></div>`:''}
        <div style="margin-top:.6rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
            <label style="font-size:.75rem;font-weight:600;color:var(--text)">Section Permissions</label>
            <div style="display:flex;gap:.4rem">
              <button class="btn btn-sm" style="font-size:.68rem" onclick="Users._checkAll(true)">All</button>
              <button class="btn btn-sm" style="font-size:.68rem" onclick="Users._checkAll(false)">None</button>
            </div>
          </div>
          <div id="uf-perms" style="display:grid;grid-template-columns:repeat(3,1fr);gap:0 .5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.6rem .8rem">${permChecks}</div>
          <div style="font-size:.68rem;color:var(--muted);margin-top:.3rem">Permissions auto-populate from the selected role. You can customise individually.</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-sm" onclick="Users._closeModal()">Cancel</button>
        <button class="btn btn-sm btn-primary" onclick="Users._saveForm('${esc(u?.id||'')}')">Save User</button>
      </div>`);
  };

  const _onRoleChange = () => {
    const role  = document.getElementById('uf-role')?.value;
    const perms = ROLE_PERMS[role] || [];
    ALL_SECTIONS.forEach(s => {
      const cb = document.getElementById('up-'+s.id);
      if (cb) cb.checked = perms.includes('all') || perms.includes(s.id);
    });
  };

  const _checkAll = (v) => { ALL_SECTIONS.forEach(s => { const cb = document.getElementById('up-'+s.id); if(cb) cb.checked = v; }); };

  const _saveForm = async (existingId) => {
    const name     = document.getElementById('uf-name')?.value.trim();
    const username = document.getElementById('uf-username')?.value.trim();
    const password = document.getElementById('uf-password')?.value;
    const confirm  = document.getElementById('uf-confirm')?.value;
    const role     = document.getElementById('uf-role')?.value;
    const active   = document.getElementById('uf-active')?.checked ?? true;

    if (!name)     { alert('Name is required.'); return; }
    if (!username) { alert('Username is required.'); return; }
    if (password && password.length < 6) { alert('Password must be at least 6 characters.'); return; }
    if (password && password !== confirm) { alert('Passwords do not match.'); return; }
    if (!existingId && !password) { alert('Password is required for new users.'); return; }

    const permissions = ALL_SECTIONS.filter(s => document.getElementById('up-'+s.id)?.checked).map(s=>s.id);

    const user = { id: existingId||'', name, username, role, active, permissions, newPassword: password||undefined };
    const d = await api('/admin/users/save', { adminKey: Store.adminKey, user });
    _closeModal();
    if (d && d.success) {
      _users = d.users;
      render();
      Auth._applyPermissions();
    } else {
      alert('✕ Failed: '+(d?.error||'Unknown error'));
    }
  };

  const deleteUser = async (id) => {
    const u = _users.find(u=>u.id===id);
    if (!confirm(`Delete user "${u?.name}"? This cannot be undone.`)) return;
    const d = await api('/admin/users/delete', { adminKey: Store.adminKey, id });
    if (d && d.success) { _users = d.users; render(); }
    else alert('✕ '+(d?.error||'Failed.'));
  };

  const revokeSessions = async (userId, name) => {
    if (!confirm(`Revoke all active sessions for ${name}? They will be logged out.`)) return;
    const d = await api('/admin/users/revoke-sessions', { adminKey: Store.adminKey, userId });
    if (d && d.success) { await load(); }
    else alert('✕ Failed.');
  };

  const revokeAllSessions = async () => {
    if (!confirm('Revoke ALL active sessions for ALL users? Everyone will be logged out (except you).')) return;
    const me = Store.currentUser;
    // Revoke all except current session
    await api('/admin/users/revoke-sessions', { adminKey: Store.adminKey, userId: null });
    await load();
  };

  const _showModal = (html) => {
    let m = document.getElementById('users-modal-overlay');
    if (!m) { m=document.createElement('div'); m.id='users-modal-overlay'; m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto'; m.addEventListener('click',e=>{if(e.target===m)_closeModal();}); document.body.appendChild(m); }
    m.innerHTML=`<div class="cust-modal" style="max-width:560px">${html}</div>`;
    m.style.display='flex';
  };
  const _closeModal = () => { const m=document.getElementById('users-modal-overlay'); if(m) m.style.display='none'; };

  return { load, render, openAdd, openEdit, deleteUser, revokeSessions, revokeAllSessions, _onRoleChange, _checkAll, _saveForm, _closeModal };
})();
