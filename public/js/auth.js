/* ─── DTC Admin — Auth Module (v2) ───────────────────────────────────────── */
'use strict';

const Auth = (() => {

  const SESSION_KEY = 'dtc_session_token';

  const _showError = (msg) => {
    const el = document.getElementById('login-err');
    if (el) { el.textContent = msg; el.classList.add('show'); }
  };
  const _clearError  = () => { const el = document.getElementById('login-err'); if (el) el.classList.remove('show'); };
  const _setLoading  = (v) => { const b = document.getElementById('login-btn'); if (b) { b.disabled = v; b.textContent = v ? 'Signing in…' : 'Sign In →'; } };

  const init = () => {
    const pwField = document.getElementById('login-password');
    if (pwField) pwField.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    const unField = document.getElementById('login-username');
    if (unField) unField.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-password')?.focus(); });

    // Auto-restore session
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) _restoreSession(saved);
  };

  const _restoreSession = async (token) => {
    try {
      const d = await api('/admin/user-verify', { adminKey: token });
      if (d && d.valid && d.user) {
        Store.setAdminKey(token);
        Store.setCurrentUser(d.user);
        await _bootApp(token);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (e) { sessionStorage.removeItem(SESSION_KEY); }
  };

  const login = async () => {
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    if (!username || !password) { _showError('Enter your username and password.'); return; }
    _clearError();
    _setLoading(true);

    try {
      const d = await api('/admin/user-login', { username, password });
      if (!d || d.error) {
        _showError(d?.error || 'Login failed.');
        _setLoading(false);
        return;
      }
      // Store session token
      sessionStorage.setItem(SESSION_KEY, d.sessionToken);
      Store.setAdminKey(d.sessionToken);
      Store.setCurrentUser(d.user);
      await _bootApp(d.sessionToken);
    } catch (e) {
      _showError('Cannot reach the server. Make sure it is running.');
    }
    _setLoading(false);
  };

  const logout = async () => {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (token) {
      await api('/admin/user-logout', { sessionToken: token }).catch(() => {});
      sessionStorage.removeItem(SESSION_KEY);
    }
    Store.setAdminKey('');
    Store.setCurrentUser(null);
    document.getElementById('app').style.display        = 'none';
    document.getElementById('login-wrap').style.display = '';
    _clearError();
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  };

  const _bootApp = async (token) => {
    // Load main data
    let data;
    try {
      data = await api('/admin/sessions-data', { adminKey: token });
    } catch (e) {
      _showError('Cannot reach the server.');
      return;
    }
    if (!data || data.error) { _showError(data?.error || 'Session invalid.'); return; }

    Store.load(data);
    if (data.currentUser) Store.setCurrentUser(data.currentUser);

    document.getElementById('login-wrap').style.display = 'none';
    document.getElementById('app').style.display        = 'flex';

    // Render user info in sidebar
    _renderUserBadge();
    // Apply permission-based nav hiding
    _applyPermissions();

    Shell.init();
    await safeRun('Instructions', Instructions.loadData);
    await safeRun('Products',     Products.loadData);
    await safeRun('BulkEmail',    BulkEmail.loadTemplates);
    await safeRun('Settings',     Settings.load);

    safeRun('Dashboard',      Dashboard.render);
    safeRun('Dashboard.dd',   Dashboard.refreshDropdowns);
    safeRun('Customers',      Customers.render);
    safeRun('EmailConfig',    EmailConfig.load);
    safeRun('EmailLog',       EmailLog.render);
    safeRun('Notifications',  Notifications.load);
    safeRun('Revenue',        Revenue.render);
    safeRun('BulkEmail.init', BulkEmail.init);
    safeRun('Resellers',      Resellers.render);
    Notifications.init();
  };

  const _renderUserBadge = () => {
    const u = Store.currentUser;
    if (!u) return;
    const el = document.getElementById('sidebar-user-badge');
    if (!el) return;
    const roleColors = { superadmin: '#534AB7', admin: '#185FA5', manager: '#1D9E75', agent: '#BA7517', viewer: '#5F5E5A' };
    const color = roleColors[u.role] || '#5563eb';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:.55rem;padding:.6rem .9rem;border-top:1px solid var(--border);cursor:pointer" onclick="Auth._showUserMenu()" title="Account settings">
        <div style="width:26px;height:26px;border-radius:50%;background:${color};color:#fff;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${(u.name||'?').charAt(0).toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.75rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.name)}</div>
          <div style="font-size:.63rem;color:var(--muted);text-transform:capitalize">${esc(u.role)}</div>
        </div>
        <span style="font-size:.8rem;color:var(--muted)">⋮</span>
      </div>`;
    el.style.display = '';
  };

  const _applyPermissions = () => {
    const u = Store.currentUser;
    if (!u) return;
    const perms = u.permissions || [];
    const hasAll = perms.includes('all');

    // Map nav page-id → permission key
    const navMap = {
      dashboard: 'dashboard', customers: 'customers', keys: 'keys',
      payments: 'payments', staff: 'staff', revenue: 'revenue',
      resellers: 'resellers', products: 'products', instructions: 'instructions',
      notifications: 'notifications', settings: 'settings', campaigns: 'campaigns',
      email: 'email', users: 'settings',
    };

    document.querySelectorAll('.nav-item[onclick]').forEach(el => {
      const m = el.getAttribute('onclick').match(/navigate\('(\w+)'/);
      if (!m) return;
      const page = m[1];
      const perm = navMap[page];
      const allowed = hasAll || !perm || perms.includes(perm);
      el.style.display = allowed ? '' : 'none';
    });

    // Show users nav only for admin+
    const canManageUsers = hasAll || u.role === 'superadmin' || u.role === 'admin';
    const usersNav = document.getElementById('nav-users');
    if (usersNav) usersNav.style.display = canManageUsers ? '' : 'none';
  };

  const _showUserMenu = () => {
    const u = Store.currentUser;
    if (!u) return;
    // Show in a simple modal overlay
    const html = `
      <div class="modal-header"><h3 style="font-size:.95rem">👤 ${esc(u.name)}</h3></div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.9rem">
          <div class="ov-card"><div class="ov-label">Username</div><div class="ov-val">${esc(u.username||'—')}</div></div>
          <div class="ov-card"><div class="ov-label">Role</div><div class="ov-val" style="text-transform:capitalize">${esc(u.role)}</div></div>
        </div>
        <div style="font-size:.72rem;color:var(--muted);margin-bottom:.8rem">Change password</div>
        <div class="form-group" style="margin-bottom:.5rem"><label>Current Password</label><input type="password" id="cp-current" placeholder="Current password"/></div>
        <div class="form-group" style="margin-bottom:.5rem"><label>New Password</label><input type="password" id="cp-new" placeholder="Min 6 characters"/></div>
        <div class="form-group"><label>Confirm New Password</label><input type="password" id="cp-confirm" placeholder="Repeat new password"/></div>
        <div id="cp-msg" style="font-size:.75rem;margin-top:.4rem;min-height:1.2rem"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-sm" onclick="Customers._closeModal()">Close</button>
        <button class="btn btn-sm" style="background:#fef2f2;border:1px solid #fecaca;color:#dc2626" onclick="Auth.logout()">Sign Out</button>
        <button class="btn btn-sm btn-primary" onclick="Auth._changePassword()">Change Password</button>
      </div>`;
    Customers._closeModal && Customers._closeModal();
    // Reuse the cust-modal overlay
    let m = document.getElementById('cust-modal-overlay');
    if (!m) { m=document.createElement('div'); m.id='cust-modal-overlay'; m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem'; m.addEventListener('click',e=>{if(e.target===m)m.style.display='none';}); document.body.appendChild(m); }
    m.innerHTML = `<div class="cust-modal">${html}</div>`;
    m.style.display='flex';
  };

  const _changePassword = async () => {
    const current  = document.getElementById('cp-current')?.value;
    const newPw    = document.getElementById('cp-new')?.value;
    const confirm  = document.getElementById('cp-confirm')?.value;
    const msg      = document.getElementById('cp-msg');
    if (!current || !newPw) { if (msg) { msg.style.color='var(--error)'; msg.textContent='Fill in all fields.'; } return; }
    if (newPw.length < 6)   { if (msg) { msg.style.color='var(--error)'; msg.textContent='Password must be at least 6 characters.'; } return; }
    if (newPw !== confirm)  { if (msg) { msg.style.color='var(--error)'; msg.textContent='Passwords do not match.'; } return; }
    const d = await api('/admin/users/change-password', { adminKey: Store.adminKey, currentPassword: current, newPassword: newPw });
    if (d && d.success) { if (msg) { msg.style.color='var(--success)'; msg.textContent='✓ Password changed.'; } }
    else { if (msg) { msg.style.color='var(--error)'; msg.textContent=(d&&d.error)||'Failed.'; } }
  };

  const safeRun = async (name, fn) => {
    try { await fn(); } catch (e) { console.warn(`[${name}]`, e.message); }
  };

  return { init, login, logout, _showUserMenu, _changePassword, _applyPermissions };
})();
