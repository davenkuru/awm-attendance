/* ═══════════════════════════════════════════════════════════
   PROFILE.JS — standalone admin profile page
   ═══════════════════════════════════════════════════════════ */

const SESSION_KEY = 'disc_admin_session';

// ── Session helpers ─────────────────────────────────────────
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.token) return null;
    if (s.expiresAt && Date.now() > s.expiresAt) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}

// ── Utility ──────────────────────────────────────────────────
function getInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return '—'; }
}

function setStatus(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-msg ' + (type || '');
  if (msg && type === 'ok') setTimeout(() => { if (el.textContent === msg) el.innerHTML = '&nbsp;'; el.className = 'status-msg'; }, 3500);
}

function setBtn(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading
    ? (id === 'name-save-btn' ? 'Saving…' : 'Updating…')
    : (id === 'name-save-btn' ? 'Save name'  : 'Update password');
}

// ── Password strength ────────────────────────────────────────
function checkPwStrength(pw) {
  const bar   = document.getElementById('pw-bar');
  const label = document.getElementById('pw-label');
  if (!bar || !label) return;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { pct: 0,   color: 'transparent',          text: '' },
    { pct: 20,  color: '#ef4444',               text: 'Very weak' },
    { pct: 40,  color: '#f97316',               text: 'Weak' },
    { pct: 60,  color: '#eab308',               text: 'Fair' },
    { pct: 80,  color: '#22c55e',               text: 'Strong' },
    { pct: 100, color: '#16a34a',               text: 'Very strong' },
  ];
  const lv = levels[score] || levels[0];
  bar.style.width     = lv.pct + '%';
  bar.style.background = lv.color;
  label.textContent   = lv.text;
}

// ── Load profile data ────────────────────────────────────────
let _token = null;

async function loadProfile() {
  const session = loadSession();
  if (!session) { window.location.replace('login.html'); return; }
  _token = session.token;

  let data;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${_token}` }
    });
    if (res.status === 401) { window.location.replace('login.html'); return; }
    data = await res.json();
  } catch (e) {
    console.error('Profile fetch failed', e);
    return;
  }

  const name = data.user_metadata?.full_name || data.email?.split('@')[0] || 'Admin';
  const role = data.user_metadata?.role || 'admin';
  const initials  = getInitials(name);
  const levelId   = data.user_metadata?.level_id;
  const roleName  = role === 'coordinator' ? 'Level ' + (levelId || 3) + ' Coordinator' : 'Administrator';
  const dashHref  = role === 'coordinator' ? 'coordinator/coordinator.html' : 'admin/admin.html';

  // Large header card
  document.getElementById('profile-avatar').textContent = initials;
  document.getElementById('profile-name').textContent   = name;

  // Role labels
  const roleDisplay = document.getElementById('user-role-display');
  const roleBadge   = document.getElementById('profile-role-badge');
  const infoRole    = document.getElementById('info-role');
  const sidebarSub  = document.getElementById('sidebar-sub');
  if (roleDisplay) roleDisplay.textContent = roleName;
  if (roleBadge)   roleBadge.textContent   = roleName;
  if (infoRole)    infoRole.textContent    = roleName;
  if (sidebarSub)  sidebarSub.textContent  = role === 'coordinator' ? 'Level ' + (levelId || 3) + ' — Coordinator' : 'Admin Panel';

  // Sidebar footer
  const sidebarAvatar = document.getElementById('user-avatar');
  const sidebarName   = document.getElementById('user-name-display');
  if (sidebarAvatar) sidebarAvatar.textContent = initials;
  if (sidebarName)   sidebarName.textContent   = name;

  // Build nav based on role
  const SVG = {
    dashboard:  '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    attendance: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>',
    reports:    '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
    members:    '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    manual:     '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
    qr:         '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"/><line x1="14" y1="14" x2="20" y2="14"/><line x1="20" y1="17" x2="20" y2="20"/><line x1="17" y1="20" x2="14" y2="20"/><line x1="14" y1="17" x2="17" y2="17"/></svg>',
  };
  const adminItems = [
    { page: 'dashboard', label: 'Dashboard' },
    { page: 'reports',   label: 'Reports' },
    { page: 'members',   label: 'Members' },
  ];
  const coordItems = [
    { page: 'dashboard',  label: 'Dashboard' },
    { page: 'attendance', label: 'Daily Attendance' },
    { page: 'reports',    label: 'Reports' },
    { page: 'members',    label: 'Members' },
    { page: 'manual',     label: 'Manual Entry' },
    { page: 'qr',         label: 'QR Code' },
  ];
  const items = role === 'coordinator' ? coordItems : adminItems;
  const navEl = document.getElementById('profile-nav');
  if (navEl) {
    navEl.innerHTML = items.map(it =>
      `<a class="nav-item" href="${dashHref}" onclick="navTo('${it.page}')">
        <span class="icon">${SVG[it.page]}</span>
        <span class="nav-label"> ${it.label}</span>
      </a>`
    ).join('');
  }

  // Name field
  document.getElementById('name-input').value = name;

  // Account info
  document.getElementById('info-email').textContent      = data.email || '—';
  document.getElementById('info-created').textContent    = fmtDate(data.created_at);
  document.getElementById('info-last-login').textContent = fmtDate(data.last_sign_in_at);
}

// ── Save display name ────────────────────────────────────────
async function saveName() {
  const input = document.getElementById('name-input');
  const name  = (input?.value || '').trim();
  if (!name) { setStatus('name-status', 'Please enter a name.', 'err'); return; }
  if (!_token) return;

  setBtn('name-save-btn', true);
  setStatus('name-status', '', '');

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: { full_name: name } })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || json.msg || 'Update failed');

    const newInitials = getInitials(name);
    document.getElementById('profile-avatar').textContent = newInitials;
    document.getElementById('profile-name').textContent   = name;
    const sidebarAvatar = document.getElementById('user-avatar');
    const sidebarName   = document.getElementById('user-name-display');
    if (sidebarAvatar) sidebarAvatar.textContent = newInitials;
    if (sidebarName)   sidebarName.textContent   = name;

    setStatus('name-status', 'Name updated successfully!', 'ok');
  } catch (e) {
    setStatus('name-status', e.message || 'Failed to update name.', 'err');
  } finally {
    setBtn('name-save-btn', false);
  }
}

// ── Change password ──────────────────────────────────────────
async function savePassword() {
  const newPw  = document.getElementById('pw-new')?.value || '';
  const confPw = document.getElementById('pw-confirm')?.value || '';

  if (!newPw) { setStatus('pw-status', 'Please enter a new password.', 'err'); return; }
  if (newPw.length < 8) { setStatus('pw-status', 'Password must be at least 8 characters.', 'err'); return; }
  if (newPw !== confPw) { setStatus('pw-status', 'Passwords do not match.', 'err'); return; }
  if (!_token) return;

  setBtn('pw-save-btn', true);
  setStatus('pw-status', '', '');

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPw })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || json.msg || 'Password update failed');

    document.getElementById('pw-new').value     = '';
    document.getElementById('pw-confirm').value = '';
    document.getElementById('pw-bar').style.width = '0';
    document.getElementById('pw-label').textContent = '';

    setStatus('pw-status', 'Password updated! Please log in again.', 'ok');

    setTimeout(() => {
      localStorage.removeItem(SESSION_KEY);
      window.location.replace('login.html');
    }, 2500);
  } catch (e) {
    setStatus('pw-status', e.message || 'Failed to update password.', 'err');
  } finally {
    setBtn('pw-save-btn', false);
  }
}

// ── Logout ───────────────────────────────────────────────────
function doLogout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.replace('login.html');
}

// ── Boot ─────────────────────────────────────────────────────
loadProfile();
