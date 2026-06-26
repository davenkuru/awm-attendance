/* ═══════════════════════════════════════════════════════════
   PASTOR.JS — Ministry Role Assignment Dashboard
   Only sees completed members. Only the pastor assigns roles.
   ═══════════════════════════════════════════════════════════ */

const SESSION_KEY = 'disc_admin_session';

// ── Current state ────────────────────────────────────────────
let _assignTargetId   = null;   // person being assigned a role
let _ministryRoles    = [];     // cached role list
let _currentMemberTab = 'pending'; // 'pending' | 'assigned'

// ── Session helpers ──────────────────────────────────────────
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.token) return null;
    if (s.expiresAt && Date.now() > s.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch { return null; }
}

function doLogout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.replace('../login.html');
}

// ── Page routing ─────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${name}'`)) {
      item.classList.add('active');
    }
  });

  closeSidebar();

  if (name === 'members') {
    setMemberTab(_currentMemberTab);
  } else if (name === 'roles') {
    loadMinistryRoles();
  }
}

// ── Sidebar helpers ──────────────────────────────────────────
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.getElementById('sidebar-backdrop').classList.toggle('visible');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('visible');
}

// ── Boot ─────────────────────────────────────────────────────
async function init() {
  const session = loadSession();
  if (!session) { window.location.replace('../login.html'); return; }

  // Set auth token so api() uses the pastor's JWT (required for PATCH/POST/DELETE)
  setAuthToken(session.token);

  // Verify role
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${session.token}` }
    });
    if (res.status === 401) { window.location.replace('../login.html'); return; }
    const data = await res.json();
    const role = data.user_metadata?.role;
    if (role !== 'pastor') { window.location.replace('../login.html'); return; }

    // Set sidebar identity
    const name = data.user_metadata?.full_name || data.email?.split('@')[0] || 'Pastor';
    const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    const avatarEl = document.getElementById('user-avatar');
    const nameEl   = document.getElementById('user-name-display');
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl)   nameEl.textContent   = name;
  } catch (e) {
    console.error('Auth check failed', e);
    window.location.replace('../login.html');
    return;
  }

  // Set date
  const dateEl = document.getElementById('dash-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Pre-load ministry roles into cache
  await fetchMinistryRoles();

  // Load dashboard
  loadDashboard();
}

// ── Ministry Roles (cache + fetch) ───────────────────────────
async function fetchMinistryRoles() {
  try {
    const data = await api('ministry_roles?order=name') || [];
    _ministryRoles = data;
  } catch (e) {
    console.error('Failed to fetch ministry roles', e);
    _ministryRoles = [];
  }
}

// ── Dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await api(
      'people?discipleship_status=in.(completed,ready_for_role)&select=id,full_name,family_name,discipleship_status,ministry_role&order=full_name'
    ) || [];

    const total    = data.length;
    const pending  = data.filter(m => m.discipleship_status === 'completed' && !m.ministry_role).length;
    const assigned = data.filter(m => m.discipleship_status === 'ready_for_role' || m.ministry_role).length;

    setText('stat-total-completed', total);
    setText('stat-pending',         pending);
    setText('stat-assigned',        assigned);
    setText('stat-roles-count',     _ministryRoles.length || '—');

    // Pending preview list
    const pendingMembers = data.filter(m => !m.ministry_role);
    const listEl = document.getElementById('dash-pending-list');
    if (!listEl) return;
    if (!pendingMembers.length) {
      listEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">All completed members have been assigned a role.</p>';
      return;
    }
    listEl.innerHTML = pendingMembers.slice(0, 6).map(m => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
        <div>
          <div style="font-weight:600;font-size:14px;">${esc(m.full_name)}</div>
          <div style="font-size:12px;color:var(--text-muted);">${esc(m.family_name || '—')}</div>
        </div>
        <button class="btn-sm btn-gold" onclick='openAssignModal("${m.id}", "${esc(m.full_name)}")'>Assign Role</button>
      </div>`).join('') +
      (pendingMembers.length > 6
        ? `<div style="font-size:12px;color:var(--text-muted);padding-top:8px;">+${pendingMembers.length - 6} more — <a href="#" onclick="showPage('members');setMemberTab('pending');return false;">view all</a></div>`
        : '');
  } catch (e) {
    console.error('Dashboard error', e);
  }
}

// ── Member tabs ───────────────────────────────────────────────
function setMemberTab(tab) {
  _currentMemberTab = tab;
  document.getElementById('mtab-pending-btn')?.classList.toggle('active', tab === 'pending');
  document.getElementById('mtab-assigned-btn')?.classList.toggle('active', tab === 'assigned');
  document.getElementById('tab-pending').style.display  = tab === 'pending'  ? 'block' : 'none';
  document.getElementById('tab-assigned').style.display = tab === 'assigned' ? 'block' : 'none';

  if (tab === 'pending')  loadPendingMembers();
  if (tab === 'assigned') loadAssignedMembers();
}

// ── Pending Members (completed, no role) ─────────────────────
async function loadPendingMembers() {
  const el = document.getElementById('pending-members-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;"><span class="spinner"></span></div>';

  const data = await api(
    'people?discipleship_status=eq.completed&ministry_role=is.null&order=full_name&select=id,full_name,family_name,phone_number,discipleship_status'
  ) || [];

  if (!data.length) {
    el.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center;">No members awaiting assignment.</p>';
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>Family</th><th>Phone</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${data.map(m => `
          <tr>
            <td><strong>${esc(m.full_name)}</strong></td>
            <td>${esc(m.family_name || '—')}</td>
            <td>${esc(m.phone_number || '—')}</td>
            <td><button class="btn-sm btn-gold" onclick='openAssignModal("${m.id}", "${esc(m.full_name)}")'>Assign Role</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── Assigned Members (ready_for_role) ────────────────────────
async function loadAssignedMembers() {
  const el = document.getElementById('assigned-members-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;"><span class="spinner"></span></div>';

  const data = await api(
    'people?discipleship_status=eq.ready_for_role&order=full_name&select=id,full_name,family_name,phone_number,ministry_role'
  ) || [];

  if (!data.length) {
    el.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center;">No members with assigned roles yet.</p>';
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>Family</th><th>Ministry Role</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${data.map(m => `
          <tr>
            <td><strong>${esc(m.full_name)}</strong></td>
            <td>${esc(m.family_name || '—')}</td>
            <td><span class="badge badge-blue">${esc(m.ministry_role || '—')}</span></td>
            <td><button class="btn-sm" onclick='openAssignModal("${m.id}", "${esc(m.full_name)}")' style="opacity:.7;">Reassign</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── Ministry Roles Page ───────────────────────────────────────
async function loadMinistryRoles() {
  await fetchMinistryRoles();
  setText('stat-roles-count', _ministryRoles.length);

  const el = document.getElementById('roles-list');
  if (!el) return;
  if (!_ministryRoles.length) {
    el.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center;">No roles defined yet.</p>';
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Role Name</th><th>Action</th></tr></thead>
      <tbody>
        ${_ministryRoles.map(r => `
          <tr>
            <td>${esc(r.name)}</td>
            <td><button class="btn-sm btn-danger" onclick='deleteMinistryRole(${r.id}, "${esc(r.name)}")'>Remove</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function addMinistryRole() {
  const input = document.getElementById('new-role-input');
  const name  = (input?.value || '').trim();
  if (!name) { alert('Please type a role name first.'); input?.focus(); return; }
  try {
    await api('ministry_roles', {
      method:  'POST',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ name })
    });
    input.value = '';
    await loadMinistryRoles();
  } catch (e) {
    const msg = e.message || 'Unknown error';
    console.error('addMinistryRole error:', msg);
    alert('Could not add role: ' + msg);
  }
}

async function deleteMinistryRole(id, name) {
  if (!confirm(`Remove "${name}" from the roles list?`)) return;
  try {
    await api(`ministry_roles?id=eq.${id}`, { method: 'DELETE' });
    await loadMinistryRoles();
  } catch (e) {
    alert('Could not remove role: ' + (e.message || 'Unknown error'));
  }
}

// ── Assign Role Modal ─────────────────────────────────────────
function openAssignModal(id, name) {
  _assignTargetId = id;

  const nameEl = document.getElementById('assign-modal-name');
  if (nameEl) nameEl.textContent = name;

  // Populate dropdown with current roles
  const select = document.getElementById('assign-role-select');
  if (select) {
    select.innerHTML = '<option value="">— Select a role —</option>' +
      _ministryRoles.map(r => `<option value="${esc(r.name)}">${esc(r.name)}</option>`).join('');
  }

  // Clear custom input and error
  const customInput = document.getElementById('assign-role-custom');
  const errorEl     = document.getElementById('assign-modal-error');
  if (customInput) customInput.value = '';
  if (errorEl)     errorEl.textContent = '';

  const overlay = document.getElementById('assign-modal-overlay');
  overlay.setAttribute('style',
    'display:flex;position:fixed;top:0;left:0;right:0;bottom:0;' +
    'background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;'
  );
}

function closeAssignModal() {
  const overlay = document.getElementById('assign-modal-overlay');
  overlay.setAttribute('style', 'display:none;');
  _assignTargetId = null;
}

async function doAssignRole() {
  if (!_assignTargetId) return;

  const selectVal = document.getElementById('assign-role-select')?.value || '';
  const customVal = (document.getElementById('assign-role-custom')?.value || '').trim();
  const role      = customVal || selectVal;

  const errorEl = document.getElementById('assign-modal-error');
  if (!role) {
    if (errorEl) errorEl.textContent = 'Please select or type a ministry role.';
    return;
  }
  if (errorEl) errorEl.textContent = '';

  const btn = document.getElementById('assign-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Assigning…'; }

  try {
    await api(`people?id=eq.${_assignTargetId}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ discipleship_status: 'ready_for_role', ministry_role: role })
    });

    closeAssignModal();
    loadDashboard();

    // Refresh whichever member tab is visible
    if (_currentMemberTab === 'pending')  loadPendingMembers();
    if (_currentMemberTab === 'assigned') loadAssignedMembers();

  } catch (e) {
    const msg = e.message || 'Could not assign role.';
    if (errorEl) errorEl.textContent = 'Error: ' + msg;
    console.error('doAssignRole error:', msg);
    alert('Assign role failed: ' + msg);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Assign Role'; }
  }
}

// ── Utilities ─────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Start ─────────────────────────────────────────────────────
init();
