/* ─── DTC Admin — Keys Module ─────────────────────────────────────────────── */
'use strict';

const Keys = (() => {

  let _keys     = [];   // all keys from server
  let _products = [];   // product list for tabs

  /* ── load ─────────────────────────────────────────────────────────────────── */
  const load = async () => {
    const [kd, pd] = await Promise.all([
      api(`/admin/keys?adminKey=${encodeURIComponent(Store.adminKey)}`),
      api(`/admin/products?adminKey=${encodeURIComponent(Store.adminKey)}`),
    ]);
    _keys     = kd && kd.keys     ? kd.keys     : [];
    _products = pd && pd.products ? pd.products : [];
    render();
  };

  /* ── render ───────────────────────────────────────────────────────────────── */
  const render = () => {
    const wrap = document.getElementById('keys-page-content');
    if(!wrap) return;

    // Group products by type
    const productTypes = {};
    _products.forEach(p => {
      const t = p.type || 'other';
      if(!productTypes[t]) productTypes[t] = { label: t==='chatgpt'?'ChatGPT Plus':t==='claude'?'Claude Pro':p.name, products: [] };
      productTypes[t].products.push(p);
    });

    // Also collect types that appear in keys but may not be in products
    _keys.forEach(k => {
      if(k.product && !productTypes[k.product]) {
        productTypes[k.product] = { label: k.product, products: [] };
      }
    });

    const typeKeys = Object.keys(productTypes);
    if(!typeKeys.length) {
      wrap.innerHTML = '<div class="empty">No products defined yet. Add products first.</div>';
      return;
    }

    // Get current active tab
    const currentTab = wrap.dataset.tab || typeKeys[0];
    const validTab   = typeKeys.includes(currentTab) ? currentTab : typeKeys[0];

    const tabNav = typeKeys.map(t => `
      <button class="ptab ${t===validTab?'ptab--active':''}"
              onclick="Keys._switchTab('${esc(t)}')">${productTypes[t].label}</button>`).join('');

    const keysForTab = _keys.filter(k => k.product === validTab);
    const used       = keysForTab.filter(k => k.usedBy);
    const unused     = keysForTab.filter(k => !k.usedBy);

    wrap.dataset.tab = validTab;
    wrap.innerHTML = `
      <div class="ptab-nav" style="margin-bottom:1.2rem">${tabNav}</div>

      <!-- Add keys section -->
      <div class="card" style="margin-bottom:1.2rem">
        <div class="card-title" style="margin-bottom:.7rem">➕ Add Keys — ${productTypes[validTab].label}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-bottom:.7rem">
          Enter one key per line, or comma-separated. Keys are unique alphanumeric identifiers assigned when activating subscriptions.
        </div>
        <textarea id="keys-input" rows="4" style="width:100%;font-family:'JetBrains Mono',monospace;font-size:.82rem;padding:.6rem .8rem;border:1.5px solid var(--border);border-radius:8px;resize:vertical;background:var(--bg);color:var(--text)" placeholder="KEY001&#10;KEY002&#10;KEY003"></textarea>
        <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" onclick="Keys.addKeys('${esc(validTab)}')">Add Keys</button>
          <span id="keys-add-msg" style="font-size:.78rem;align-self:center;color:var(--success)"></span>
        </div>
      </div>

      <!-- Stats row -->
      <div class="stats" style="margin-bottom:1.2rem">
        <div class="stat"><div class="stat-val">${keysForTab.length}</div><div class="stat-lbl">Total Keys</div></div>
        <div class="stat"><div class="stat-val sv-green">${unused.length}</div><div class="stat-lbl">Available</div></div>
        <div class="stat"><div class="stat-val sv-blue">${used.length}</div><div class="stat-lbl">Used</div></div>
      </div>

      <!-- Unused keys -->
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem">
          <div class="card-title" style="margin-bottom:0">🟢 Available Keys (${unused.length})</div>
          ${unused.length?`<button class="btn btn-sm" style="border:1px solid #fecaca;color:#dc2626;background:#fef2f2" onclick="Keys.deleteUnused('${esc(validTab)}')">🗑 Clear All Unused</button>`:''}
        </div>
        ${unused.length ? `
          <div class="keys-grid">
            ${unused.map(k=>`
              <div class="key-chip key-chip--unused">
                <span class="key-chip-val">${esc(k.key)}</span>
                <button class="key-chip-del" title="Delete key" onclick="Keys.deleteKey('${esc(k.key)}','${esc(validTab)}')">×</button>
              </div>`).join('')}
          </div>` : '<div class="empty" style="padding:.8rem">No available keys. Add some above.</div>'}
      </div>

      <!-- Used keys -->
      <div class="card">
        <div class="card-title" style="margin-bottom:.8rem">🔵 Used Keys (${used.length})</div>
        ${used.length ? `
          <div class="keys-table-wrap">
            <table class="keys-table">
              <thead><tr><th>Key</th><th>Customer</th><th>Package</th><th>Assigned</th></tr></thead>
              <tbody>
                ${used.map(k=>`
                  <tr>
                    <td><span class="key-chip key-chip--used" style="display:inline-flex">${esc(k.key)}</span></td>
                    <td>${esc(k.customerName||'—')}</td>
                    <td>${esc(k.packageType||'—')}</td>
                    <td>${k.assignedAt?new Date(k.assignedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<div class="empty" style="padding:.8rem">No used keys yet.</div>'}
      </div>`;
  };

  const _switchTab = (product) => {
    const wrap = document.getElementById('keys-page-content');
    if(wrap) { wrap.dataset.tab = product; render(); }
  };

  /* ── add keys ─────────────────────────────────────────────────────────────── */
  const addKeys = async (product) => {
    const raw = document.getElementById('keys-input').value;
    const keys = raw.split(/[\n,]+/).map(k=>k.trim()).filter(Boolean);
    if(!keys.length) { alert('Enter at least one key.'); return; }

    const d = await api('/admin/keys/add', { adminKey: Store.adminKey, product, keys });
    const msg = document.getElementById('keys-add-msg');
    if(d && d.added !== undefined) {
      if(msg) msg.textContent = `✓ ${d.added} added, ${d.skipped||0} skipped (duplicates)`;
      document.getElementById('keys-input').value = '';
      await load();
    } else {
      if(msg) { msg.style.color='var(--error)'; msg.textContent = '✕ Failed: '+(d&&d.error||'Unknown'); }
    }
  };

  /* ── delete one key ───────────────────────────────────────────────────────── */
  const deleteKey = async (key, product) => {
    if(!confirm(`Delete key "${key}"?`)) return;
    const d = await api('/admin/keys/delete', { adminKey: Store.adminKey, key });
    if(d&&d.success) await load();
    else alert('✕ Failed: '+(d&&d.error||'Unknown'));
  };

  /* ── delete all unused for a product ─────────────────────────────────────── */
  const deleteUnused = async (product) => {
    const count = _keys.filter(k=>k.product===product&&!k.usedBy).length;
    if(!confirm(`Delete all ${count} unused keys for this product?`)) return;
    const d = await api('/admin/keys/delete-unused', { adminKey: Store.adminKey, product });
    if(d&&d.success) await load();
    else alert('✕ Failed: '+(d&&d.error||'Unknown'));
  };

  return { load, render, addKeys, deleteKey, deleteUnused, _switchTab };
})();
