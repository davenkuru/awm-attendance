/* ═══════════════════════════════════════════════════════════
   LOGIN.JS — standalone login page logic
   Depends on: config.js (SUPABASE_URL, SUPABASE_KEY)
   ═══════════════════════════════════════════════════════════ */

const SESSION_KEY = 'disc_admin_session';

function saveSession(token, email, expiresAt) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, email, expiresAt }));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.token || !s.expiresAt) return null;
    if (Date.now() >= s.expiresAt) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}

// ── Role selector ─────────────────────────────────────────────
let selectedRole = 'admin';

function selectRole(role) {
  selectedRole = role;
  document.getElementById('role-admin').classList.toggle('active', role === 'admin');
  document.getElementById('role-coordinator').classList.toggle('active', role === 'coordinator');
  document.getElementById('login-title').textContent = role === 'coordinator' ? 'Coordinator Login' : 'Admin Login';
}

// Determine redirect destination based on role in user metadata
function getRedirectUrl(userData) {
  const role = userData?.user_metadata?.role;
  if (role === 'coordinator') return 'coordinator/';
  return 'admin/';
}

// If already logged in, fetch user role and redirect
(async function() {
  const s = loadSession();
  if (!s) return;
  try {
    const res  = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${s.token}` }
    });
    const data = await res.json();
    window.location.replace(getRedirectUrl(data));
  } catch {
    window.location.replace('admin/');
  }
})();

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const err   = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');

  if (!email || !pass) { err.textContent = 'Please enter your email and password.'; return; }

  err.textContent  = '';
  btn.textContent  = 'Signing in…';
  btn.disabled     = true;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:  'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);

    const expiresAt  = Date.now() + (data.expires_in || 3600) * 1000;
    const actualRole = data.user?.user_metadata?.role || 'admin';

    // Validate selected role matches the account
    if (selectedRole === 'coordinator' && actualRole !== 'coordinator') {
      throw new Error('This account is not a coordinator account. Please select Admin.');
    }
    if (selectedRole === 'admin' && actualRole === 'coordinator') {
      throw new Error('This is a coordinator account. Please select Coordinator.');
    }

    saveSession(data.access_token, email, expiresAt);
    window.location.href = getRedirectUrl(data.user);

  } catch(e) {
    err.textContent = e.message || 'Login failed. Check your credentials.';
    btn.textContent = 'Sign In';
    btn.disabled    = false;
  }
}

// Allow Enter key to submit
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('login-email').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-password').focus();
});
