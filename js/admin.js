/* ═══════════════════════════════════════════════════════════
   ADMIN.JS — admin panel logic
   Depends on: config.js · api.js · theme.js
   ═══════════════════════════════════════════════════════════ */

// ── AUTH ──
const SESSION_KEY = 'disc_admin_session';

// ── LEVEL SELECTION ──
// selectedLevel: which level's data to show. Coordinator is locked to their level.
let selectedLevel = 3;
window._dashData   = null;  // cache for last full dashboard fetch

function saveSession(token, email, expiresAt) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, email, expiresAt }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.token || !s.expiresAt) return null;
    if (Date.now() >= s.expiresAt) { clearSession(); return null; }
    return s;
  } catch { return null; }
}

window._adminUser = null;

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

async function fetchAndShowUser(token) {
  try {
    const res  = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    window._adminUser = data;

    // Lock coordinator to their assigned level
    if (window.IS_COORDINATOR && data.user_metadata?.level_id) {
      selectedLevel = data.user_metadata.level_id;
    }

    // Hide Completed tab for Level 1 and Level 2 coordinators
    if (window.IS_COORDINATOR && data.user_metadata?.level_id !== 3) {
      const completedBtn = document.getElementById('mview-completed-btn');
      if (completedBtn) completedBtn.style.display = 'none';
    }

    const name    = data.user_metadata?.full_name || data.email?.split('@')[0] || 'Admin';
    const levelId = data.user_metadata?.level_id;
    document.getElementById('user-name-display').textContent = name;
    document.getElementById('user-avatar').textContent       = getInitials(name);

    // Update sidebar subtitle and footer role with correct level for coordinators
    if (window.IS_COORDINATOR) {
      const subEl  = document.getElementById('sidebar-sub');
      const roleEl = document.getElementById('user-role-display');
      if (subEl)  subEl.textContent  = 'Level ' + (levelId || 3) + ' — Coordinator';
      if (roleEl) roleEl.textContent = 'Level ' + (levelId || 3) + ' Coordinator';
    }
  } catch(e) { /* silent — sidebar shows defaults */ }
}

async function startApp(token, email) {
  setAuthToken(token);
  await fetchAndShowUser(token);
  initApp();
  // If arriving from profile.html via a sidebar link, jump to that page
  const navPage = localStorage.getItem('awm_nav_page');
  if (navPage) {
    localStorage.removeItem('awm_nav_page');
    showPage(navPage);
  }
}

function doLogout() {
  setAuthToken(null);
  clearSession();
  const inSubdir = /\/(admin|coordinator)\//.test(window.location.pathname);
  window.location.replace(inSubdir ? '../login.html' : 'login.html');
}

// Restore session or redirect to login
(function checkSavedSession() {
  const s = loadSession();
  if (s) {
    startApp(s.token, s.email);
  } else {
    const inSubdir = /\/(admin|coordinator)\//.test(window.location.pathname);
    window.location.replace(inSubdir ? '../login.html' : 'login.html');
  }
})();

// ── SIDEBAR TOGGLE ──
const SIDEBAR_KEY = 'awm_sidebar_collapsed';

function isMobile()  { return window.innerWidth < 768; }
function isTablet()  { return window.innerWidth >= 768 && window.innerWidth < 1200; }
function isDesktop() { return window.innerWidth >= 1200; }

function toggleSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const main     = document.querySelector('.main');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (isMobile() || isTablet()) {
    // Overlay mode: slide in / slide out
    const isOpen = sidebar.classList.toggle('open');
    backdrop.classList.toggle('visible', isOpen);
  } else {
    // Desktop mode: collapse / expand
    const collapsed = sidebar.classList.toggle('collapsed');
    main.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('visible');
}

// Close sidebar when navigating on mobile/tablet
const _origShowPage = typeof showPage === 'function' ? showPage : null;

// Restore desktop sidebar state on load
(function applySidebarState() {
  if (isDesktop() && localStorage.getItem(SIDEBAR_KEY) === '1') {
    document.querySelector('.sidebar')?.classList.add('collapsed');
    document.querySelector('.main')?.classList.add('sidebar-collapsed');
  }
})();

// Close sidebar on resize if switching to desktop
window.addEventListener('resize', () => {
  if (isDesktop()) {
    closeSidebar();
  }
});

// ── NAVIGATION ──
function showPage(name) {
  if (isMobile() || isTablet()) closeSidebar();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');

  const navItems = document.querySelectorAll('.nav-item');
  const map = window.IS_COORDINATOR
    ? { dashboard: 0, attendance: 1, reports: 2, members: 3, manual: 4, qr: 5 }
    : { dashboard: 0, reports: 1, members: 2 };
  if (map[name] !== undefined) navItems[map[name]].classList.add('active');

  // Inject a level badge into pages that are level-scoped
  // Admin members shows all levels so no badge needed there
  const levelPages = window.IS_COORDINATOR
    ? ['attendance', 'reports', 'members', 'manual']
    : ['reports'];
  if (levelPages.includes(name)) {
    const page = document.getElementById('page-' + name);
    const sub  = page ? page.querySelector('.page-sub') : null;
    if (sub && !sub.querySelector('.level-badge')) {
      const badge = document.createElement('span');
      badge.className   = 'level-badge';
      badge.style.cssText = 'display:inline-block;margin-left:10px;font-size:11px;font-weight:700;background:rgba(var(--gold-rgb),0.15);color:var(--gold);border-radius:999px;padding:2px 10px;letter-spacing:.06em;vertical-align:middle;';
      sub.appendChild(badge);
    }
    const badge = page ? page.querySelector('.level-badge') : null;
    if (badge) badge.textContent = 'Level ' + selectedLevel;
  }

  if (name === 'attendance') {
    const d = document.getElementById('attendance-date');
    if (!d.value) d.value = new Date().toISOString().split('T')[0];
    loadAttendanceForDate();
  }
  if (name === 'attendance' && document.getElementById('att-roster-filter')) {
    document.getElementById('att-roster-filter').value = '';
    if (document.getElementById('att-status-filter')) document.getElementById('att-status-filter').value = 'all';
  }
  if (name === 'reports')  loadReports();
  if (name === 'members')  loadMembers();
  if (name === 'manual')   initManualEntry();
  if (name === 'qr')       renderQR();
}

// ── INIT ──
let allMembers = [];

async function initApp() {
  const today = new Date();
  document.getElementById('dash-date').textContent = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  loadDashboard();
}

// ── DASHBOARD ──

async function loadDashboard() {
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  try {
    const [people, sessions, checkIns] = await Promise.all([
      api('people?select=id,full_name,family_name,current_level_id&limit=1000&order=full_name'),
      api('sessions?select=id,session_date,title,level_id&order=session_date.desc&limit=1000'),
      api('check_ins?select=person_id,session_id,checked_in_at&limit=10000')
    ]);

    window._dashData = {
      people:   people   || [],
      sessions: sessions || [],
      checkIns: checkIns || []
    };

    renderLevelCards(people, sessions, checkIns);
    renderDashboardDetail(people, sessions, checkIns);
    loadMinistryReady();

  } catch(e) {
    console.error('Dashboard error:', e);
  }
}

// Render the 3 level summary cards (admin sees all 3 clickable; coordinator sees only theirs)
function renderLevelCards(allPeople, allSessions, allCheckIns) {
  const el = document.getElementById('level-cards');
  if (!el) return;

  const todayISO = new Date().toISOString().split('T')[0];
  const isCoord  = !!window.IS_COORDINATOR;

  // Build maps
  const sessionCIMap = {};
  const personCIMap  = {};
  (allCheckIns || []).forEach(ci => {
    if (!sessionCIMap[ci.session_id]) sessionCIMap[ci.session_id] = new Set();
    sessionCIMap[ci.session_id].add(ci.person_id);
    if (!personCIMap[ci.person_id]) personCIMap[ci.person_id] = [];
    personCIMap[ci.person_id].push(ci.session_id);
  });

  const levels     = isCoord ? [selectedLevel] : [1, 2, 3];
  const levelNames = { 1: 'Level 1', 2: 'Level 2', 3: 'Level 3 — S.H.A.P.E' };

  const cards = levels.map(lid => {
    const members  = (allPeople  || []).filter(p => p.current_level_id === lid);
    const sessions = (allSessions || []).filter(s => s.level_id === lid && s.session_date <= todayISO);
    const memberIds = new Set(members.map(m => m.id));

    // Last session rate for this level
    const lastSess = sessions.find(s => [...(sessionCIMap[s.id] || [])].some(id => memberIds.has(id))) || sessions[0];
    let lastRate = '—';
    if (lastSess && members.length > 0) {
      const present = [...(sessionCIMap[lastSess.id] || [])].filter(id => memberIds.has(id)).length;
      lastRate = Math.round(present / members.length * 100) + '%';
    }

    const isActive  = lid === selectedLevel;
    const clickAttr = isCoord ? '' : 'onclick="selectLevel(' + lid + ')"';
    const noHover   = isCoord ? ' no-hover' : '';

    return '<div class="level-card' + (isActive ? ' active' : '') + noHover + '" data-level="' + lid + '" ' + clickAttr + '>'
         + '<div class="level-card-label">' + (levelNames[lid] || 'Level ' + lid) + '</div>'
         + '<div class="level-card-stats">'
         + '<div class="level-card-stat"><div class="level-card-stat-value">' + members.length + '</div><div class="level-card-stat-label">Members</div></div>'
         + '<div class="level-card-stat"><div class="level-card-stat-value">' + lastRate + '</div><div class="level-card-stat-label">Last Session</div></div>'
         + '</div>'
         + '</div>';
  }).join('');

  el.innerHTML = cards;
  el.style.gridTemplateColumns = isCoord ? '1fr 1fr 1fr' : 'repeat(3, 1fr)';
}

// Switch the active level and re-render the detail panel (admin only)
function selectLevel(lid) {
  if (selectedLevel === lid) return;
  selectedLevel = lid;

  // Reset section caches so they reload with new level on next visit
  allMembers           = [];
  manualMembers        = [];
  attendanceRosterData = [];
  reportData           = [];

  // Update card highlight
  document.querySelectorAll('.level-card').forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.level) === lid);
  });

  // Re-render detail from cached data (no extra fetch needed)
  if (window._dashData) {
    renderDashboardDetail(window._dashData.people, window._dashData.sessions, window._dashData.checkIns);
  }
}

// Render the detail panel (stats grid, trend, at-risk, families) for selectedLevel
function renderDashboardDetail(allPeople, allSessions, allCheckIns) {
  const todayISO = new Date().toISOString().split('T')[0];

  // Filter to selectedLevel
  const members  = (allPeople  || []).filter(p => p.current_level_id === selectedLevel);
  const sessions = (allSessions || []).filter(s => s.level_id === selectedLevel);
  const memberIds = new Set(members.map(m => m.id));

  // Build maps
  const sessionCIMap = {};
  const personCIMap  = {};
  (allCheckIns || []).forEach(ci => {
    if (!sessionCIMap[ci.session_id]) sessionCIMap[ci.session_id] = new Set();
    sessionCIMap[ci.session_id].add(ci.person_id);
    if (!personCIMap[ci.person_id]) personCIMap[ci.person_id] = [];
    personCIMap[ci.person_id].push(ci.session_id);
  });

  // Helper: count of level members present in a session
  const levelPresent = sid => [...(sessionCIMap[sid] || [])].filter(id => memberIds.has(id)).length;

  const totalMembers = members.length;
  document.getElementById('stat-total').textContent    = totalMembers;
  document.getElementById('stat-sessions').textContent = sessions.length;

  const uniqueFamilies = new Set(members.map(m => m.family_name).filter(Boolean));
  document.getElementById('stat-families').textContent = uniqueFamilies.size;

  // Today's session for this level
  const pastSessions  = sessions.filter(s => s.session_date <= todayISO);
  const todaySession  = sessions.find(s => s.session_date === todayISO);
  const todayCount    = todaySession ? levelPresent(todaySession.id) : 0;
  document.getElementById('stat-today').textContent      = todayCount;
  document.getElementById('stat-today-desc').textContent = todaySession
    ? todayCount + ' of ' + totalMembers + ' checked in'
    : 'No session today';

  // Last session with any attendance for this level
  const lastSession = pastSessions.find(s => levelPresent(s.id) > 0) || pastSessions[0];
  if (lastSession) {
    const lCount = levelPresent(lastSession.id);
    const lRate  = totalMembers > 0 ? Math.round(lCount / totalMembers * 100) : 0;
    document.getElementById('last-session-title').textContent = lastSession.title || 'Discipleship Class';
    document.getElementById('last-session-date').textContent  = new Date(lastSession.session_date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    document.getElementById('last-session-count').textContent = lCount;
    document.getElementById('last-session-rate').textContent  = lRate + '%';
  } else {
    document.getElementById('last-session-title').textContent = 'No sessions yet';
    document.getElementById('last-session-date').textContent  = '—';
    document.getElementById('last-session-count').textContent = '—';
    document.getElementById('last-session-rate').textContent  = '—';
  }

  // Trend chart — last 6 sessions for this level
  const trendSessions = pastSessions.slice(0, 6).reverse();
  const trendBars     = document.getElementById('trend-bars');
  if (trendSessions.length === 0) {
    trendBars.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No sessions yet</div>';
  } else {
    const maxCount = Math.max(...trendSessions.map(s => levelPresent(s.id)), 1);
    const cols = trendSessions.map(s => {
      const cnt      = levelPresent(s.id);
      const pct      = totalMembers > 0 ? Math.round(cnt / totalMembers * 100) : 0;
      const barH     = Math.max(4, Math.round((cnt / maxCount) * 60));
      const dateStr  = new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const barColor = pct >= 75 ? 'rgba(76,175,125,0.55)' : pct >= 40 ? 'rgba(200,169,110,0.5)' : 'rgba(200,169,110,0.2)';
      return { barH, barColor, dateStr, pct, cnt };
    });
    trendBars.innerHTML =
      '<div class="trend-bars-row">'
      + cols.map(c => '<div class="trend-bar-col" title="' + c.dateStr + ': ' + c.cnt + ' present (' + c.pct + '%)"><div class="trend-bar" style="height:' + c.barH + 'px;background:' + c.barColor + ';"></div></div>').join('')
      + '</div>'
      + '<div class="trend-labels-row">'
      + cols.map(c => '<div class="trend-label-col"><span class="trend-bar-date">' + c.dateStr + '</span><span class="trend-bar-pct">' + c.pct + '%</span></div>').join('')
      + '</div>';
  }

  // Family engagement bars (scoped to this level's members)
  const famMap = {};
  members.forEach(m => {
    const f = m.family_name || 'No Family';
    if (!famMap[f]) famMap[f] = { total: 0, attended: 0 };
    famMap[f].total++;
    if ((personCIMap[m.id] || []).length > 0) famMap[f].attended++;
  });
  window._famData = Object.entries(famMap)
    .filter(([f]) => f !== 'No Family')
    .sort((a, b) => (b[1].attended / b[1].total) - (a[1].attended / a[1].total))
    .map(([name, d]) => ({ name, pct: Math.round(d.attended / d.total * 100), total: d.total, attended: d.attended }));
  window._famPage = 1;
  renderFamilies(1);
}

const FAM_PAGE_SIZE = 12;
function renderFamilies(page) {
  const data = window._famData || [];
  const el   = document.getElementById('dash-family-bars');
  if (!data.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">No family data</div>';
    return;
  }
  window._famPage = page;
  const start = (page - 1) * FAM_PAGE_SIZE;
  const slice = data.slice(start, start + FAM_PAGE_SIZE);
  el.innerHTML = slice.map(d => `
    <div class="fam-mini-row">
      <div class="fam-mini-name" title="${d.name}">${d.name}</div>
      <div class="fam-mini-bar-wrap"><div class="fam-mini-bar" style="width:${d.pct}%"></div></div>
      <div class="fam-mini-pct">${d.pct}%</div>
    </div>`).join('');
}

function goToTodayAttendance() {
  document.getElementById('attendance-date').value = new Date().toISOString().split('T')[0];
  showPage('attendance');
  loadAttendanceForDate();
}

// ── ATTENDANCE ──
let attendanceRosterData = [];
let rosterFilteredData   = [];
let rosterPage           = 1;
const ROSTER_PAGE_SIZE   = 10;

async function loadAttendanceForDate() {
  const dateVal = document.getElementById('attendance-date').value;
  if (!dateVal) return;

  ['att-stat-present','att-stat-absent','att-stat-total','att-stat-pct']
    .forEach(id => document.getElementById(id).textContent = '—');
  document.getElementById('att-family-list').innerHTML  = '<div style="text-align:center;padding:32px;color:var(--text-muted);"><span class="spinner"></span></div>';
  document.getElementById('att-roster-body').innerHTML  = '<tr class="loading-row"><td colspan="5"><span class="spinner"></span></td></tr>';
  document.getElementById('att-roster-filter').value    = '';
  document.getElementById('att-pagination').style.display = 'none';
  rosterPage = 1;

  try {
    const [allPeople, sessions] = await Promise.all([
      api('people?order=full_name&limit=1000&select=id,full_name,family_name,phone_number&current_level_id=eq.' + selectedLevel),
      api('sessions?session_date=eq.' + dateVal + '&level_id=eq.' + selectedLevel + '&limit=1')
    ]);

    const checkedInMap = {};
    if (sessions && sessions.length > 0) {
      const cis = await api(`check_ins?session_id=eq.${sessions[0].id}&select=person_id,checked_in_at`);
      if (cis) cis.forEach(ci => { checkedInMap[ci.person_id] = ci.checked_in_at; });
    }

    const total   = (allPeople || []).length;
    const present = Object.keys(checkedInMap).length;
    const pct     = total > 0 ? Math.round(present / total * 100) : 0;

    document.getElementById('att-stat-present').textContent = present;
    document.getElementById('att-stat-absent').textContent  = total - present;
    document.getElementById('att-stat-total').textContent   = total;
    document.getElementById('att-stat-pct').textContent     = pct + '%';

    const dateLabel = new Date(dateVal + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
    document.getElementById('att-date-label').textContent = dateLabel;

    // Family breakdown
    const familyMap = {};
    (allPeople || []).forEach(p => {
      const fam = p.family_name || '(No family)';
      if (!familyMap[fam]) familyMap[fam] = { present: 0, total: 0 };
      familyMap[fam].total++;
      if (checkedInMap[p.id]) familyMap[fam].present++;
    });

    const families = Object.entries(familyMap).sort((a, b) => a[0].localeCompare(b[0]));
    document.getElementById('att-family-list').innerHTML = families.length
      ? families.map(([name, d]) => {
          const pctF = d.total > 0 ? Math.round(d.present / d.total * 100) : 0;
          return `
            <div class="family-row" onclick="filterRosterByFamily(${JSON.stringify(name)})">
              <span class="family-row-name">${name}</span>
              <div class="family-bar-track"><div class="family-bar-fill" style="width:${pctF}%"></div></div>
              <span class="family-count">${d.present}/${d.total}</span>
            </div>`;
        }).join('')
      : '<div style="text-align:center;padding:32px;color:var(--text-muted);">No members found</div>';

    attendanceRosterData = (allPeople || []).map(p => ({
      ...p, present: !!checkedInMap[p.id], checked_in_at: checkedInMap[p.id] || null
    }));
    renderRoster(attendanceRosterData);

  } catch(e) {
    document.getElementById('att-roster-body').innerHTML =
      `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--error);">Error: ${e.message}</td></tr>`;
  }
}

function renderRoster(members, page) {
  rosterFilteredData = members || [];
  rosterPage         = page || 1;
  const tbody      = document.getElementById('att-roster-body');
  const pagination = document.getElementById('att-pagination');

  if (!rosterFilteredData.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">No members match</td></tr>';
    pagination.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(rosterFilteredData.length / ROSTER_PAGE_SIZE);
  rosterPage = Math.max(1, Math.min(rosterPage, totalPages));
  const start = (rosterPage - 1) * ROSTER_PAGE_SIZE;
  const slice = rosterFilteredData.slice(start, start + ROSTER_PAGE_SIZE);

  tbody.innerHTML = slice.map(m => {
    const time = m.checked_in_at
      ? new Date(m.checked_in_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '—';
    return `
      <tr>
        <td><strong>${m.full_name}</strong></td>
        <td style="color:var(--text-muted);">${m.family_name || '—'}</td>
        <td class="${m.present ? 'status-present' : 'status-absent'}">${m.present ? 'Present' : 'Absent'}</td>
        <td style="color:var(--text-muted);">${m.phone_number || '—'}</td>
        <td style="color:var(--text-muted);">${time}</td>
      </tr>`;
  }).join('');

  pagination.style.display = 'flex';
  document.getElementById('att-page-info').textContent =
    `${start + 1}–${Math.min(start + ROSTER_PAGE_SIZE, rosterFilteredData.length)} of ${rosterFilteredData.length} members`;
  document.getElementById('att-page-num').textContent  = `Page ${rosterPage} of ${totalPages}`;
  document.getElementById('att-prev-btn').disabled = rosterPage <= 1;
  document.getElementById('att-next-btn').disabled = rosterPage >= totalPages;
}

function rosterChangePage(delta) {
  renderRoster(rosterFilteredData, rosterPage + delta);
  document.getElementById('att-roster-body').closest('.table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterRoster() {
  const q      = (document.getElementById('att-roster-filter').value || '').toLowerCase();
  const status = document.getElementById('att-status-filter')?.value || 'all';
  let filtered = attendanceRosterData;
  if (q) filtered = filtered.filter(m => m.full_name.toLowerCase().includes(q) || (m.family_name || '').toLowerCase().includes(q));
  if (status === 'present') filtered = filtered.filter(m =>  m.present);
  else if (status === 'absent') filtered = filtered.filter(m => !m.present);
  renderRoster(filtered, 1);
}

function filterRosterByFamily(name) {
  document.getElementById('att-roster-filter').value = name;
  filterRoster();
  document.getElementById('att-roster-body').closest('.table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── ATTENDANCE PDF EXPORT ──
function openAttPdfModal() {
  const dateVal = document.getElementById('attendance-date').value;
  if (!dateVal) { alert('Please select a date first.'); return; }
  if (!attendanceRosterData.length) { alert('No attendance data loaded. Select a date and refresh first.'); return; }
  // Reset to default selection
  const def = document.querySelector('input[name="att-pdf-scope"][value="all"]');
  if (def) def.checked = true;
  document.getElementById('att-pdf-modal').classList.add('open');
}
function closeAttPdfModal() {
  document.getElementById('att-pdf-modal').classList.remove('open');
}
document.getElementById('att-pdf-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('att-pdf-modal')) closeAttPdfModal();
});

function runAttendancePDF() {
  const scope = document.querySelector('input[name="att-pdf-scope"]:checked')?.value || 'all';
  closeAttPdfModal();
  exportAttendancePDF(scope);
}

async function exportAttendancePDF(scope = 'all') {
  const dateVal = document.getElementById('attendance-date').value;
  if (!dateVal) return;

  // Apply scope filter on top of any active roster filter
  let base = attendanceRosterData;
  if (scope === 'present') base = attendanceRosterData.filter(m => m.present);
  else if (scope === 'absent') base = attendanceRosterData.filter(m => !m.present);

  // Also respect the current name/family search filter if active
  const q      = (document.getElementById('att-roster-filter').value || '').toLowerCase().trim();
  const data   = q ? base.filter(m => m.full_name.toLowerCase().includes(q) || (m.family_name || '').toLowerCase().includes(q)) : base;

  if (!data.length) { alert('No members match the selected report type.'); return; }

  // Lazy-load jsPDF
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  if (!window.jspdf?.jsPDF?.prototype?.autoTable) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const gold  = [200, 169, 110];
  const navy  = [9, 13, 23];
  const gray  = [120, 139, 160];

  // Header banner
  const dateLabel = new Date(dateVal + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 36, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...gold);
  doc.text('AWM / ZTCC', 14, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 200, 200);
  doc.text('Discipleship Class', 14, 19);
  const scopeLabel = scope === 'present' ? 'Present Members' : scope === 'absent' ? 'Absent Members' : 'Daily Attendance';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text(scopeLabel, 14, 29);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
  doc.text(dateLabel, pageW - 14, 29, { align: 'right' });

  let nextY = 42;

  // Stats row
  const present = data.filter(m => m.present).length;
  const absent  = data.length - present;
  const pct     = data.length > 0 ? Math.round(present / data.length * 100) : 0;

  const stats = [
    { label: 'Present',    value: String(present) },
    { label: 'Absent',     value: String(absent)  },
    { label: 'Total',      value: String(data.length) },
    { label: 'Attendance', value: pct + '%' },
  ];
  const boxW = (pageW - 28 - 12) / 4;
  stats.forEach((s, i) => {
    const x = 14 + i * (boxW + 4);
    doc.setFillColor(240, 242, 245);
    doc.roundedRect(x, nextY, boxW, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...navy);
    doc.text(s.value, x + boxW / 2, nextY + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...gray);
    doc.text(s.label.toUpperCase(), x + boxW / 2, nextY + 15, { align: 'center' });
  });
  nextY += 24;

  // Filter / scope note
  const filterQ = document.getElementById('att-roster-filter').value.trim();
  const notes = [];
  if (scope !== 'all') notes.push(scope === 'present' ? 'Present members only' : 'Absent members only');
  if (filterQ) notes.push(`Search: "${filterQ}"`);
  if (notes.length) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...gray);
    doc.text(`Filtered — ${notes.join(' · ')}`, 14, nextY);
    nextY += 6;
  }

  // Member table
  doc.autoTable({
    startY: nextY,
    head: [['#', 'Name', 'Family', 'Status', 'Check-in Time']],
    body: data.map((m, i) => {
      const time = m.checked_in_at
        ? new Date(m.checked_in_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '—';
      return [i + 1, m.full_name, m.family_name || '—', m.present ? 'Present' : 'Absent', time];
    }),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: navy, textColor: gold, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 249, 251] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'center' },
    },
    didParseCell(d) {
      if (d.section === 'body' && d.column.index === 3) {
        d.cell.styles.textColor = d.cell.raw === 'Present' ? [76, 175, 125] : [180, 60, 60];
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Footer on every page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...navy);
    doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageW, 10, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...gold);
    doc.text('AWM / ZTCC — Discipleship Attendance', 14, doc.internal.pageSize.getHeight() - 3.5);
    doc.setTextColor(180, 180, 180);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, doc.internal.pageSize.getHeight() - 3.5, { align: 'right' });
  }

  const fileName = `attendance_${dateVal}.pdf`;
  doc.save(fileName);
}

// ── REPORTS ──
let reportData         = [];
let reportFilteredData = [];
let reportPage         = 1;
const REPORT_PAGE_SIZE = 10;
let reportSessions     = [];
let reportLevelFilter  = 'all';   // admin only; coordinator uses selectedLevel

function setReportLevel(lvl) {
  if (window.IS_COORDINATOR) return;
  reportLevelFilter = lvl;
  document.querySelectorAll('#page-reports .mlevel-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.level === lvl);
  });
  const labelEl = document.getElementById('rep-level-label');
  if (labelEl) {
    const names = { all: 'all levels', '1': 'Level 1', '2': 'Level 2', '3': 'Level 3' };
    labelEl.textContent = names[lvl] || lvl;
  }
  // Update table header: show/hide Level column
  const thead = document.getElementById('rep-thead');
  if (thead) {
    thead.innerHTML = lvl === 'all'
      ? '<tr><th>Name</th><th>Level</th><th>Family</th><th>Sessions</th><th>Rate</th><th>Last Attended</th></tr>'
      : '<tr><th>Name</th><th>Family</th><th>Sessions</th><th>Rate</th><th>Last Attended</th></tr>';
  }
  reportData = [];
  loadReports();
}

async function loadReports() {
  const tbody    = document.getElementById('reports-body');
  const isAllLvl = !window.IS_COORDINATOR && reportLevelFilter === 'all';
  const cols     = isAllLvl ? 6 : 5;
  tbody.innerHTML = `<tr class="loading-row"><td colspan="${cols}"><span class="spinner"></span></td></tr>`;
  document.getElementById('rep-pagination').style.display = 'none';
  ['rep-stat-sessions','rep-stat-active','rep-stat-never'].forEach(id => document.getElementById(id).textContent = '—');

  try {
    let people, sessions, checkIns;

    if (isAllLvl) {
      // Admin "All" mode — fetch everything, compute rates per person against their level
      [people, sessions, checkIns] = await Promise.all([
        api('people?order=full_name&limit=1000&select=id,full_name,family_name,current_level_id'),
        api('sessions?select=id,session_date,title,level_id&order=session_date.desc&limit=1000'),
        api('check_ins?select=person_id,session_id,checked_in_at&limit=10000&order=checked_in_at.desc')
      ]);
    } else {
      const lvl = window.IS_COORDINATOR ? selectedLevel : reportLevelFilter;
      [people, sessions, checkIns] = await Promise.all([
        api('people?order=full_name&limit=1000&select=id,full_name,family_name,current_level_id&current_level_id=eq.' + lvl),
        api('sessions?select=id,session_date,title,level_id&order=session_date.desc&limit=1000&level_id=eq.' + lvl),
        api('check_ins?select=person_id,session_id,checked_in_at&limit=10000&order=checked_in_at.desc')
      ]);
    }

    reportSessions = sessions || [];

    // Build a sessions-by-level lookup and flat set of all relevant session IDs
    const sessionsByLevel = {};
    reportSessions.forEach(s => {
      const l = s.level_id || 3;
      if (!sessionsByLevel[l]) sessionsByLevel[l] = new Set();
      sessionsByLevel[l].add(s.id);
    });
    const allSessionIds = new Set(reportSessions.map(s => s.id));

    // Build detailed check-in map: person_id → { sessionId → date }
    const ciDetailed = {};
    (checkIns || []).filter(ci => allSessionIds.has(ci.session_id)).forEach(ci => {
      if (!ciDetailed[ci.person_id]) ciDetailed[ci.person_id] = {};
      ciDetailed[ci.person_id][ci.session_id] = ci.checked_in_at;
    });

    reportData = (people || []).map(p => {
      const lvlId       = p.current_level_id || 3;
      const lvlSessIds  = isAllLvl ? (sessionsByLevel[lvlId] || new Set()) : allSessionIds;
      const lvlSessCnt  = lvlSessIds.size;
      const personalCIs = ciDetailed[p.id] || {};

      let count = 0, lastDate = null;
      Object.entries(personalCIs).forEach(([sid, checkedAt]) => {
        if (lvlSessIds.has(sid)) {
          count++;
          const d = checkedAt?.split('T')[0];
          if (!lastDate || d > lastDate) lastDate = d;
        }
      });

      return {
        ...p,
        sessions: count,
        rate:     lvlSessCnt > 0 ? Math.round(count / lvlSessCnt * 100) : 0,
        lastDate
      };
    });

    const active = reportData.filter(p => p.sessions > 0).length;
    const never  = reportData.length - active;

    document.getElementById('rep-stat-sessions').textContent = reportSessions.length;
    document.getElementById('rep-stat-active').textContent   = active;
    document.getElementById('rep-stat-never').textContent    = never;

    document.getElementById('rep-filter').value = '';
    document.getElementById('rep-sort').value   = 'rate_desc';
    reportData.sort((a, b) => b.rate - a.rate);
    renderReport(reportData, 1);

  } catch(e) {
    const cols = !window.IS_COORDINATOR && reportLevelFilter === 'all' ? 6 : 5;
    tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--error);">Error: ${e.message}</td></tr>`;
  }
}

function renderReport(data, page) {
  reportFilteredData = data || [];
  reportPage         = page || 1;
  const tbody      = document.getElementById('reports-body');
  const pagination = document.getElementById('rep-pagination');
  const isAllLvl   = !window.IS_COORDINATOR && reportLevelFilter === 'all';
  const cols       = isAllLvl ? 6 : 5;

  if (!reportFilteredData.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--text-muted);">No members found</td></tr>`;
    pagination.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(reportFilteredData.length / REPORT_PAGE_SIZE);
  reportPage = Math.max(1, Math.min(reportPage, totalPages));
  const start = (reportPage - 1) * REPORT_PAGE_SIZE;
  const slice = reportFilteredData.slice(start, start + REPORT_PAGE_SIZE);

  tbody.innerHTML = slice.map(m => {
    const lastStr   = m.lastDate
      ? new Date(m.lastDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
    const rateColor = m.rate >= 75 ? '#4caf7d' : m.rate >= 40 ? 'var(--gold)' : 'var(--text-muted)';
    const lvl       = m.current_level_id || 3;
    const lvlStyle  = LEVEL_COLORS[lvl] || LEVEL_COLORS[3];
    const levelCell = isAllLvl
      ? `<td><span class="badge" style="${lvlStyle}font-size:11px;padding:2px 8px;border-radius:6px;">L${lvl}</span></td>`
      : '';
    return `
      <tr style="cursor:pointer;" onclick="viewMemberAttendance('${m.id}','${m.full_name.replace(/'/g,"\\'")}')">
        <td><strong style="color:var(--gold);">${m.full_name}</strong></td>
        ${levelCell}
        <td style="color:var(--text-muted);">${m.family_name || '—'}</td>
        <td>${m.sessions > 0 ? `<span class="badge badge-green">${m.sessions}</span>` : '<span class="badge badge-gray">0</span>'}</td>
        <td style="font-weight:600;color:${rateColor};">${m.rate}%</td>
        <td style="color:var(--text-muted);">${lastStr}</td>
      </tr>`;
  }).join('');

  pagination.style.display = 'flex';
  document.getElementById('rep-page-info').textContent =
    `${start + 1}–${Math.min(start + REPORT_PAGE_SIZE, reportFilteredData.length)} of ${reportFilteredData.length} members`;
  document.getElementById('rep-page-num').textContent  = `Page ${reportPage} of ${totalPages}`;
  document.getElementById('rep-prev-btn').disabled = reportPage <= 1;
  document.getElementById('rep-next-btn').disabled = reportPage >= totalPages;
}

function repChangePage(delta) {
  renderReport(reportFilteredData, reportPage + delta);
  document.getElementById('reports-body').closest('.table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterReport() {
  const q    = (document.getElementById('rep-filter').value || '').toLowerCase();
  const sort = document.getElementById('rep-sort').value;
  let filtered = q
    ? reportData.filter(m => m.full_name.toLowerCase().includes(q) || (m.family_name || '').toLowerCase().includes(q))
    : [...reportData];
  if (sort === 'sessions_desc') filtered.sort((a, b) => b.sessions - a.sessions);
  else if (sort === 'sessions_asc') filtered.sort((a, b) => a.sessions - b.sessions);
  else if (sort === 'rate_desc') filtered.sort((a, b) => b.rate - a.rate);
  else filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
  renderReport(filtered, 1);
}

// ── PDF EXPORT ──
function openPdfModal() {
  if (!reportData.length) { alert('Load the report first.'); return; }
  document.getElementById('pdf-export-modal').classList.add('open');
}
function closePdfModal() {
  document.getElementById('pdf-export-modal').classList.remove('open');
}
document.getElementById('pdf-export-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('pdf-export-modal')) closePdfModal();
});

async function runExportPDF() {
  closePdfModal();
  const scope        = document.querySelector('input[name="pdf-scope"]:checked')?.value || 'all';
  const incStats     = document.getElementById('pdf-inc-stats').checked;
  const incTable     = document.getElementById('pdf-inc-table').checked;
  const incFamily    = document.getElementById('pdf-inc-family').checked;
  const incLast      = document.getElementById('pdf-inc-last').checked;
  const titleOverride = document.getElementById('pdf-title-override').value.trim() || 'Member Attendance Report';

  let data;
  if (scope === 'filtered') data = reportFilteredData.length ? reportFilteredData : reportData;
  else if (scope === 'never') data = reportData.filter(m => m.sessions === 0);
  else data = reportData;

  if (!data.length) { alert('No data to export for the selected option.'); return; }
  await exportReportPDF(data, { incStats, incTable, incFamily, incLast, title: titleOverride, scope });
}

async function exportReportPDF(data, opts = {}) {
  const { incStats = true, incTable = true, incFamily = true, incLast = true, title = 'Member Attendance Report' } = opts;

  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  if (!window.jspdf?.jsPDF?.prototype?.autoTable) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const gold  = [200, 169, 110];
  const navy  = [9, 13, 23];
  const gray  = [120, 139, 160];

  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 36, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...gold);
  doc.text('AWM / ZTCC', 14, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 200, 200);
  doc.text('Discipleship Class', 14, 19);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text(title, 14, 29);
  const genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
  doc.text(`Generated: ${genDate}`, pageW - 14, 29, { align: 'right' });

  let nextY = 42;

  if (incStats) {
    const totalSessions = document.getElementById('rep-stat-sessions').textContent;
    const activeMembers = document.getElementById('rep-stat-active').textContent;
    const neverAttended = document.getElementById('rep-stat-never').textContent;
    const stats = [
      { label: 'Total Sessions', value: totalSessions },
      { label: 'Active Members', value: activeMembers },
      { label: 'Never Attended', value: neverAttended },
    ];
    const boxW = (pageW - 28) / 3;
    stats.forEach((s, i) => {
      const x = 14 + i * (boxW + 4);
      doc.setFillColor(240, 242, 245);
      doc.roundedRect(x, nextY, boxW, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...navy);
      doc.text(s.value, x + boxW / 2, nextY + 10, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...gray);
      doc.text(s.label.toUpperCase(), x + boxW / 2, nextY + 15, { align: 'center' });
    });
    nextY += 24;
  }

  if (incTable) {
    const heads = ['#', 'Name'];
    if (incFamily) heads.push('Family');
    heads.push('Sessions', 'Rate');
    if (incLast) heads.push('Last Attended');

    doc.autoTable({
      startY: nextY,
      head: [heads],
      body: data.map((m, i) => {
        const row = [i + 1, m.full_name];
        if (incFamily) row.push(m.family_name || '—');
        row.push(m.sessions, m.rate + '%');
        if (incLast) row.push(m.lastDate ? new Date(m.lastDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
        return row;
      }),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: navy, textColor: gold, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 4) {
          const pct = parseInt(data.cell.raw);
          if      (pct >= 75) data.cell.styles.textColor = [76, 175, 125];
          else if (pct >= 40) data.cell.styles.textColor = [176, 96, 0];
          else                data.cell.styles.textColor = [150, 150, 150];
        }
      },
      margin: { left: 14, right: 14 },
    });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(...gray);
    doc.text('AWM / ZTCC Discipleship Class — Attendance Report', 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  doc.save(`attendance_report_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ── MEMBERS PDF EXPORT ──
function openMembersPdfModal() {
  if (!allMembers.length) { alert('Load the members list first.'); return; }

  // Populate family dropdown dynamically
  const sel = document.getElementById('mpdf-family');
  sel.innerHTML = '<option value="all">All families</option>';
  const families = [...new Set(allMembers.map(m => m.family_name).filter(Boolean))].sort();
  families.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    sel.appendChild(opt);
  });

  // Reset level radios to "all"
  const radios = document.querySelectorAll('input[name="mpdf-level"]');
  radios.forEach(r => { r.checked = r.value === 'all'; });

  document.getElementById('members-pdf-modal').classList.add('open');
}

function closeMembersPdfModal() {
  document.getElementById('members-pdf-modal').classList.remove('open');
}

async function runMembersPdfExport() {
  closeMembersPdfModal();

  const lvl    = document.querySelector('input[name="mpdf-level"]:checked')?.value || 'all';
  const family = document.getElementById('mpdf-family').value;
  const colLevel  = document.getElementById('mpdf-col-level').checked;
  const colFamily = document.getElementById('mpdf-col-family').checked;
  const colPhone  = document.getElementById('mpdf-col-phone').checked;
  const colStatus = document.getElementById('mpdf-col-status').checked;
  const titleVal  = document.getElementById('mpdf-title').value.trim() || 'AWM / ZTCC — Member Roster';

  let data = allMembers.slice();
  if (lvl !== 'all') data = data.filter(m => String(m.current_level_id) === lvl);
  if (family !== 'all') data = data.filter(m => m.family_name === family);

  if (!data.length) { alert('No members match the selected filters.'); return; }

  // Load jsPDF + autotable (reuse if already loaded)
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  if (!window.jspdf?.jsPDF?.prototype?.autoTable) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const gold  = [200, 169, 110];
  const navy  = [9, 13, 23];
  const gray  = [120, 139, 160];

  const levelNames = { '1': 'Level 1', '2': 'Level 2', '3': 'Level 3', 'all': 'All Levels' };
  const subtitle = (family !== 'all' ? family : (lvl !== 'all' ? levelNames[lvl] : 'All Levels'));

  // Header
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 36, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...gold);
  doc.text('AWM / ZTCC', 14, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 200, 200);
  doc.text('Discipleship Class', 14, 19);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text(titleVal, 14, 29);
  const genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
  doc.text(`Generated: ${genDate}`, pageW - 14, 29, { align: 'right' });

  let nextY = 42;

  // Summary row
  const byLevel = {};
  data.forEach(m => {
    const l = m.current_level_id || 3;
    byLevel[l] = (byLevel[l] || 0) + 1;
  });
  const summaryItems = [
    { label: 'Total Members', value: String(data.length) },
    { label: 'Level 1', value: String(byLevel[1] || 0) },
    { label: 'Level 2', value: String(byLevel[2] || 0) },
    { label: 'Level 3', value: String(byLevel[3] || 0) },
  ];
  const boxW = (pageW - 28) / 4;
  summaryItems.forEach((s, i) => {
    const x = 14 + i * (boxW + 4);
    doc.setFillColor(240, 242, 245);
    doc.roundedRect(x, nextY, boxW, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...navy);
    doc.text(s.value, x + boxW / 2, nextY + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...gray);
    doc.text(s.label.toUpperCase(), x + boxW / 2, nextY + 15, { align: 'center' });
  });
  nextY += 24;

  // Table
  const heads = ['#', 'Name'];
  if (colLevel)  heads.push('Level');
  if (colFamily) heads.push('Family');
  if (colPhone)  heads.push('Phone');
  if (colStatus) heads.push('Status');

  const LEVEL_LABEL = { 1: 'L1', 2: 'L2', 3: 'L3' };

  doc.autoTable({
    startY: nextY,
    head: [heads],
    body: data.map((m, i) => {
      const row = [i + 1, m.full_name];
      if (colLevel)  row.push(LEVEL_LABEL[m.current_level_id] || 'L3');
      if (colFamily) row.push(m.family_name || '—');
      if (colPhone)  row.push(m.phone_number || '—');
      if (colStatus) row.push(m.is_active === false ? 'Disabled' : 'Active');
      return row;
    }),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: navy, textColor: gold, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 249, 251] },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
    },
    didParseCell(d) {
      if (colStatus && d.section === 'body' && d.column.index === heads.length - 1) {
        if (d.cell.raw === 'Disabled') d.cell.styles.textColor = [239, 68, 68];
        else d.cell.styles.textColor = [76, 175, 125];
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(...gray);
    doc.text('AWM / ZTCC Discipleship Class — Member Roster', 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  const slug = (family !== 'all' ? family.replace(/\s+/g,'_') : (lvl !== 'all' ? 'level' + lvl : 'all'));
  doc.save(`members_${slug}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ── MEMBERS ──
async function loadMembers() {
  const tbody = document.getElementById('members-body');
  if (window.IS_COORDINATOR) {
    tbody.innerHTML = '<tr class="loading-row"><td colspan="5"><span class="spinner"></span></td></tr>';
  } else {
    tbody.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);"><span class="spinner"></span></div>';
  }
  if (window.IS_COORDINATOR) {
    // Coordinator only sees their assigned level
    allMembers = await api('people?order=full_name&limit=1000&select=id,full_name,family_name,phone_number,is_active,current_level_id&current_level_id=eq.' + selectedLevel);
  } else {
    // Admin sees all members across all levels
    allMembers = await api('people?order=full_name&limit=1000&select=id,full_name,family_name,phone_number,is_active,current_level_id');
  }
  renderMembersTable(allMembers);
}

let memberLevelFilter = 'all';

function setMemberLevel(lvl) {
  memberLevelFilter = lvl;
  document.querySelectorAll('.mlevel-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.level === lvl);
  });
  filterMembers();
}

function filterMembers() {
  const q = document.getElementById('member-search').value.toLowerCase();
  let filtered = allMembers.filter(m =>
    m.full_name.toLowerCase().includes(q) || (m.family_name || '').toLowerCase().includes(q)
  );
  if (memberLevelFilter !== 'all') {
    filtered = filtered.filter(m => String(m.current_level_id) === memberLevelFilter);
  }
  renderMembersTable(filtered);
}

const LEVEL_COLORS = {
  1: 'background:rgba(99,102,241,0.12);color:#6366f1;',
  2: 'background:rgba(16,185,129,0.12);color:#10b981;',
  3: 'background:rgba(var(--gold-rgb),0.12);color:var(--gold);'
};

function renderMembersTable(members) {
  const el      = document.getElementById('members-body');
  const isCoord = !!window.IS_COORDINATOR;

  // ── COORDINATOR: keep original table rows ──
  if (isCoord) {
    if (!members || members.length === 0) {
      el.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:#7a8ba0;">No members found</td></tr>';
      return;
    }
    el.innerHTML = members.map(m => {
      const active     = m.is_active !== false;
      const nameStr    = m.full_name.replace(/"/g, '&quot;');
      const memberJson = JSON.stringify(m).replace(/'/g, '&#39;');
      const disabledLabel = active ? '' : ' <span style="font-size:11px;color:#ef4444;margin-left:4px;">(disabled)</span>';
      const familyBadge   = m.family_name
        ? '<span class="badge badge-blue">' + m.family_name + '</span>'
        : '<span class="badge badge-gray">—</span>';
      const statusCol = active ? '<td></td>' : '<td><span class="badge" style="background:rgba(239,68,68,0.12);color:#ef4444;font-size:11px;">Disabled</span></td>';
      const toggleBtn = active
        ? '<button class="btn-sm" style="background:rgba(239,68,68,0.1);color:#ef4444;" onclick=\'disableMember("' + m.id + '", "' + nameStr + '")\'>Disable</button>'
        : '<button class="btn-sm" style="background:rgba(76,175,125,0.15);color:#4caf7d;" onclick=\'enableMember("' + m.id + '", "' + nameStr + '")\'>Enable</button>';
      const graduateBtn = window.IS_COORDINATOR
        ? (selectedLevel < 3
            ? '<button class="btn-sm" style="background:rgba(76,175,125,0.15);color:#4caf7d;font-weight:600;" onclick=\'graduateMember("' + m.id + '", "' + nameStr + '")\'>Graduate →</button>'
            : '<button class="btn-sm" style="background:rgba(201,168,76,0.15);color:#c9a84c;font-weight:600;" onclick=\'graduateMember("' + m.id + '", "' + nameStr + '")\'>Mark Completed ✓</button>')
        : '';
      const actionBtns = '<button class="btn-sm" style="background:#f0fdf4;color:#166534;" onclick=\'viewMemberAttendance("' + m.id + '", "' + nameStr + '")\'>History</button>'
                       + '<button class="btn-sm btn-edit" onclick=\'openEditModal(' + memberJson + ')\'>Edit</button>'
                       + toggleBtn
                       + graduateBtn;
      const cb = '<td style="width:32px;"><input type="checkbox" class="member-cb" data-id="' + m.id + '" data-name="' + nameStr + '" onchange="onMemberCbChange()" /></td>';
      return '<tr style="' + (active ? '' : 'opacity:0.55;') + '">'
        + cb
        + '<td><strong>' + m.full_name + '</strong>' + disabledLabel + '</td>'
        + '<td>' + familyBadge + '</td>'
        + '<td>' + (m.phone_number || '—') + '</td>'
        + statusCol
        + '<td><div class="action-btns">' + actionBtns + '</div></td>'
        + '</tr>';
    }).join('');
    return;
  }

  // ── ADMIN: card layout ──
  const countEl = document.getElementById('member-count-label');
  if (countEl) countEl.textContent = (members ? members.length : 0) + ' member' + (members && members.length === 1 ? '' : 's');

  if (!members || members.length === 0) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">No members found</div>';
    return;
  }

  el.innerHTML = members.map(m => {
    const active     = m.is_active !== false;
    const nameStr    = m.full_name.replace(/"/g, '&quot;');
    const memberJson = JSON.stringify(m).replace(/'/g, '&#39;');
    const lvl        = m.current_level_id || 3;
    const lvlStyle   = LEVEL_COLORS[lvl] || LEVEL_COLORS[3];

    // Initials (up to 2 chars)
    const parts    = m.full_name.trim().split(' ');
    const initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();

    // Level badge
    const badge = '<span class="badge" style="' + lvlStyle + 'font-size:11px;padding:2px 8px;border-radius:6px;">L' + lvl + '</span>';

    // Meta line: family · phone
    const metaParts = [m.family_name, m.phone_number].filter(Boolean);
    const meta = metaParts.length ? metaParts.join(' · ') : '—';

    // Action buttons
    const histBtn     = '<button class="btn-sm" onclick=\'viewMemberAttendance("' + m.id + '", "' + nameStr + '")\'>History</button>';
    const editBtn     = '<button class="btn-sm btn-edit" onclick=\'openEditModal(' + memberJson + ')\'>Edit</button>';
    const delBtn      = '<button class="btn-sm btn-delete" onclick=\'openDeleteModal("' + m.id + '", "' + nameStr + '")\'>Delete</button>';
    const gradBtn = window.IS_COORDINATOR
      ? (lvl < 3
          ? '<button class="btn-sm" style="background:rgba(76,175,125,0.15);color:#4caf7d;font-weight:600;" onclick=\'graduateMember("' + m.id + '", "' + nameStr + '")\'>Graduate →</button>'
          : '<button class="btn-sm" style="background:rgba(201,168,76,0.15);color:#c9a84c;font-weight:600;" onclick=\'graduateMember("' + m.id + '", "' + nameStr + '")\'>Mark Completed ✓</button>')
      : '';

    return '<div class="member-card' + (active ? '' : ' mc-disabled') + '" style="position:relative;">'
      + '<input type="checkbox" class="member-cb" data-id="' + m.id + '" data-name="' + nameStr + '" onchange="onMemberCbChange()" style="position:absolute;top:10px;left:10px;width:15px;height:15px;cursor:pointer;" />'
      + '<div class="mc-header" style="padding-left:28px;">'
      +   '<div class="mc-avatar">' + initials + '</div>'
      +   '<div class="mc-info">'
      +     '<div class="mc-name">' + m.full_name + '</div>'
      +     '<div class="mc-meta">' + meta + '</div>'
      +   '</div>'
      +   '<div class="mc-badge">' + badge + '</div>'
      + '</div>'
      + '<div class="mc-actions">' + histBtn + editBtn + delBtn + gradBtn + '</div>'
      + '</div>';
  }).join('');
}

async function disableMember(id, name) {
  if (!confirm(`Disable ${name}?\nThey will remain in the system but be marked inactive.`)) return;
  try {
    await api(`people?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ is_active: false }) });
    loadMembers();
  } catch(e) { alert('Error: ' + e.message); }
}

async function enableMember(id, name) {
  if (!confirm(`Re-enable ${name}?`)) return;
  try {
    await api(`people?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ is_active: true }) });
    loadMembers();
  } catch(e) { alert('Error: ' + e.message); }
}

// ════════════════════════════════════
// GRADUATION
// ════════════════════════════════════

async function doGraduate(ids, names) {
  const nextLevel = selectedLevel + 1;
  const completingProgram = selectedLevel === 3;

  let label, confirmMsg;
  if (completingProgram) {
    label = ids.length === 1
      ? `Mark ${names[0]} as Completed?`
      : `Mark ${ids.length} members as Completed?`;
    confirmMsg = label + '\n\nThey have finished all discipleship levels. The Pastor will assign them a ministry role.';
  } else {
    label = ids.length === 1
      ? `Graduate ${names[0]} to Level ${nextLevel}?`
      : `Graduate ${ids.length} members to Level ${nextLevel}?`;
    confirmMsg = label + '\n\nThis will move them out of Level ' + selectedLevel + ' and into Level ' + nextLevel + '. Their attendance history is kept.';
  }
  if (!confirm(confirmMsg)) return;

  const today = new Date().toISOString().split('T')[0];

  try {
    for (const id of ids) {
      // 1. Mark current level enrollment as graduated
      const existing = await api(`level_enrollments?person_id=eq.${id}&level_id=eq.${selectedLevel}&limit=1`);
      if (existing && existing.length > 0) {
        await api(`level_enrollments?person_id=eq.${id}&level_id=eq.${selectedLevel}`, {
          method: 'PATCH',
          body: JSON.stringify({ graduated_at: today, status: 'graduated' })
        });
      } else {
        await api('level_enrollments', {
          method: 'POST',
          body: JSON.stringify({ person_id: id, level_id: selectedLevel, enrolled_at: today, graduated_at: today, status: 'graduated' })
        });
      }

      if (completingProgram) {
        // Mark as completed — no next level enrollment
        await api(`people?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ discipleship_status: 'completed' })
        });
      } else {
        // Enroll in next level
        try {
          await api('level_enrollments', {
            method: 'POST',
            body: JSON.stringify({ person_id: id, level_id: nextLevel, enrolled_at: today, status: 'active' })
          });
        } catch(e) { /* already enrolled — skip */ }
        await api(`people?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ current_level_id: nextLevel })
        });
      }
    }
    clearMemberSelection();
    loadMembers();
  } catch(e) {
    alert('Error: ' + (e.message || 'Unknown error'));
  }
}

async function graduateMember(id, name) {
  await doGraduate([id], [name]);
}

// ── Load Completed Members (read-only — role assignment is Pastor only) ──
async function loadCompleted() {
  const container = document.getElementById('completed-body');
  if (!container) return;
  const data = await api('people?discipleship_status=in.(completed,ready_for_role)&order=full_name&select=id,full_name,family_name,phone_number,discipleship_status,ministry_role') || [];
  if (!data.length) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:16px;">No completed members yet.</p>';
    return;
  }
  container.innerHTML = `
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
      Ministry role assignment is handled by the Pastor.
    </p>
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>Family</th><th>Status</th><th>Ministry Role</th>
      </tr></thead>
      <tbody>
        ${data.map(m => {
          const statusBadge = m.discipleship_status === 'ready_for_role'
            ? '<span class="badge" style="background:rgba(201,168,76,0.2);color:#c9a84c;">Role Assigned</span>'
            : '<span class="badge" style="background:rgba(76,175,125,0.15);color:#4caf7d;">Completed</span>';
          const roleBadge = m.ministry_role
            ? '<span class="badge badge-blue">' + m.ministry_role + '</span>'
            : '<span style="color:var(--text-muted);">Awaiting Pastor</span>';
          return `<tr>
            <td><strong>${m.full_name}</strong></td>
            <td>${m.family_name || '—'}</td>
            <td>${statusBadge}</td>
            <td>${roleBadge}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── Load Ministry Ready (dashboard card) ─────────────────────────────
async function loadMinistryReady() {
  const container = document.getElementById('ministry-ready-list');
  if (!container) return;
  const data = await api('people?discipleship_status=eq.ready_for_role&order=full_name&select=full_name,ministry_role,family_name') || [];
  const countEl = document.getElementById('ministry-ready-count');
  if (countEl) countEl.textContent = data.length;
  if (!data.length) { container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No members assigned yet.</p>'; return; }
  container.innerHTML = data.map(m => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-weight:600;font-size:13px;">${m.full_name}</div>
        <div style="font-size:11px;color:var(--text-muted);">${m.family_name || ''}</div>
      </div>
      <span class="badge" style="background:rgba(201,168,76,0.2);color:#c9a84c;">${m.ministry_role}</span>
    </div>`).join('');
}

async function bulkGraduate() {
  const checked = document.querySelectorAll('.member-cb:checked');
  if (!checked.length) return;
  const ids   = [...checked].map(cb => cb.dataset.id);
  const names = [...checked].map(cb => cb.dataset.name);
  await doGraduate(ids, names);
}

function onMemberCbChange() {
  const all     = document.querySelectorAll('.member-cb');
  const checked = document.querySelectorAll('.member-cb:checked');
  const bar     = document.getElementById('bulk-action-bar');
  const label   = document.getElementById('bulk-selected-label');
  const allCb   = document.getElementById('select-all-cb');

  if (bar) bar.style.display = checked.length > 0 ? 'flex' : 'none';
  if (label) label.textContent = checked.length + ' member' + (checked.length !== 1 ? 's' : '') + ' selected';
  if (allCb) allCb.indeterminate = checked.length > 0 && checked.length < all.length;
  if (allCb) allCb.checked = all.length > 0 && checked.length === all.length;
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.member-cb').forEach(cb => { cb.checked = checked; });
  onMemberCbChange();
}

function clearMemberSelection() {
  document.querySelectorAll('.member-cb').forEach(cb => { cb.checked = false; });
  const allCb = document.getElementById('select-all-cb');
  if (allCb) { allCb.checked = false; allCb.indeterminate = false; }
  onMemberCbChange();
}

// ════════════════════════════════════
// GRADUATED VIEW
// ════════════════════════════════════

let memberView = 'active';        // 'active' | 'graduated' | 'completed'
let graduatedLevelFilter = 'all'; // 'all' | '1' | '2' | '3'
const LEVEL_NAMES_MAP = { 1: 'Level 1', 2: 'Level 2', 3: 'Level 3 — S.H.A.P.E' };

function setMemberView(view) {
  memberView = view;

  // Toggle button styles
  document.getElementById('mview-active-btn')?.classList.toggle('active', view === 'active');
  document.getElementById('mview-graduated-btn')?.classList.toggle('active', view === 'graduated');
  document.getElementById('mview-completed-btn')?.classList.toggle('active', view === 'completed');

  // Show/hide sections
  const activeTable  = document.getElementById('active-members-table');
  const membersGrid  = document.getElementById('members-body');
  const gradBody     = document.getElementById('graduated-body');
  const bulkBar      = document.getElementById('bulk-action-bar');
  const levelTabs    = document.getElementById('member-level-tabs');
  const gradTabs     = document.getElementById('graduated-level-tabs');
  const addBtn       = document.querySelector('[onclick="openMemberModal()"]');
  const uploadBtn    = document.querySelector('[onclick="openBulkUploadModal()"]');
  const pdfBtn       = document.querySelector('[onclick="openMembersPdfModal()"]');
  const searchInput  = document.getElementById('member-search');

  const gradToolbar = document.getElementById('graduated-toolbar');

  if (view === 'graduated') {
    if (activeTable)  activeTable.style.display = 'none';
    if (membersGrid)  membersGrid.style.display = 'none';
    if (gradBody)     gradBody.style.display = 'block';
    if (gradToolbar)  gradToolbar.style.display = 'flex';
    if (bulkBar)      bulkBar.style.display = 'none';
    if (levelTabs)    levelTabs.style.display = 'none';
    if (gradTabs)     gradTabs.style.display = 'block';
    if (addBtn)       addBtn.style.display = 'none';
    if (uploadBtn)    uploadBtn.style.display = 'none';
    if (pdfBtn)       pdfBtn.style.display = 'none';
    if (searchInput)  searchInput.placeholder = 'Search graduated members…';
    const completedBody = document.getElementById('completed-body');
    if (completedBody) completedBody.style.display = 'none';
    loadGraduated();
  } else if (view === 'completed') {
    if (activeTable)  activeTable.style.display = 'none';
    if (membersGrid)  membersGrid.style.display = 'none';
    if (gradBody)     gradBody.style.display = 'none';
    if (gradToolbar)  gradToolbar.style.display = 'none';
    if (bulkBar)      bulkBar.style.display = 'none';
    if (levelTabs)    levelTabs.style.display = 'none';
    if (gradTabs)     gradTabs.style.display = 'none';
    if (addBtn)       addBtn.style.display = 'none';
    if (uploadBtn)    uploadBtn.style.display = 'none';
    if (pdfBtn)       pdfBtn.style.display = 'none';
    if (searchInput)  searchInput.placeholder = 'Search completed members…';
    const completedBody = document.getElementById('completed-body');
    if (completedBody) completedBody.style.display = 'block';
    loadCompleted();
  } else {
    if (activeTable)  activeTable.style.display = '';
    if (membersGrid)  membersGrid.style.display = '';
    if (gradBody)     gradBody.style.display = 'none';
    if (gradToolbar)  gradToolbar.style.display = 'none';
    if (levelTabs)    levelTabs.style.display = '';
    if (gradTabs)     gradTabs.style.display = 'none';
    if (addBtn)       addBtn.style.display = '';
    if (uploadBtn)    uploadBtn.style.display = '';
    if (pdfBtn)       pdfBtn.style.display = '';
    if (searchInput)  searchInput.placeholder = window.IS_COORDINATOR ? 'Search name…' : 'Search name or family…';
    const completedBody = document.getElementById('completed-body');
    if (completedBody) completedBody.style.display = 'none';
    loadMembers();
  }
}

function setGraduatedLevel(lvl) {
  graduatedLevelFilter = lvl;
  document.querySelectorAll('.glevel-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.level === lvl);
  });
  renderGraduated();
}

let allGraduated = [];

async function loadGraduated() {
  const tbody = document.getElementById('graduated-list');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);"><span class="spinner"></span></td></tr>';

  // Query level_enrollments joined with people for graduated rows
  let url = 'level_enrollments?status=eq.graduated&select=level_id,enrolled_at,graduated_at,person_id,people(id,full_name,family_name,current_level_id)&order=graduated_at.desc&limit=500';
  if (window.IS_COORDINATOR) {
    url += '&level_id=eq.' + selectedLevel;
  }

  try {
    const data = await api(url);
    allGraduated = (data || []).map(row => ({
      person_id:      row.person_id,
      name:           row.people?.full_name || '—',
      family:         row.people?.family_name || '—',
      from_level:     row.level_id,
      graduated_at:   row.graduated_at,
      enrolled_at:    row.enrolled_at,
      current_level:  row.people?.current_level_id
    }));
    renderGraduated();
  } catch(e) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#ef4444;">Failed to load graduated members.</td></tr>';
  }
}

function renderGraduated() {
  const tbody   = document.getElementById('graduated-list');
  const countEl = document.getElementById('member-count-label');
  const search  = (document.getElementById('member-search')?.value || '').toLowerCase();
  const fromDate = document.getElementById('grad-date-from')?.value || '';
  const toDate   = document.getElementById('grad-date-to')?.value || '';

  let rows = allGraduated;
  if (graduatedLevelFilter !== 'all') {
    rows = rows.filter(r => String(r.from_level) === graduatedLevelFilter);
  }
  if (search) {
    rows = rows.filter(r => r.name.toLowerCase().includes(search) || r.family.toLowerCase().includes(search));
  }
  if (fromDate) {
    rows = rows.filter(r => r.graduated_at && r.graduated_at >= fromDate);
  }
  if (toDate) {
    rows = rows.filter(r => r.graduated_at && r.graduated_at <= toDate);
  }

  if (countEl) countEl.textContent = rows.length + ' graduated member' + (rows.length !== 1 ? 's' : '');

  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">No graduated members found for this filter.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const gradDate   = r.graduated_at ? new Date(r.graduated_at).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }) : '—';
    const fromBadge  = '<span class="badge" style="' + (LEVEL_COLORS[r.from_level] || '') + 'font-size:11px;padding:2px 8px;border-radius:6px;">Level ' + r.from_level + '</span>';
    const nowBadge   = r.current_level
      ? '<span class="badge" style="' + (LEVEL_COLORS[r.current_level] || '') + 'font-size:11px;padding:2px 8px;border-radius:6px;">Level ' + r.current_level + '</span>'
      : '—';
    const histBtn    = '<button class="btn-sm" style="background:#f0fdf4;color:#166534;" onclick=\'viewMemberAttendance("' + r.person_id + '", "' + r.name.replace(/"/g,'&quot;') + '")\'>History</button>';
    return '<tr style="border-bottom:0.5px solid var(--border);">'
      + '<td style="padding:10px 12px;font-weight:500;">' + r.name + '</td>'
      + '<td style="padding:10px 12px;color:var(--text-muted);">' + r.family + '</td>'
      + '<td style="padding:10px 12px;">' + fromBadge + '</td>'
      + '<td style="padding:10px 12px;color:var(--text-muted);">' + gradDate + '</td>'
      + '<td style="padding:10px 12px;">' + nowBadge + '</td>'
      + '<td style="padding:10px 12px;">' + histBtn + '</td>'
      + '</tr>';
  }).join('');
}

function clearGraduatedDates() {
  const f = document.getElementById('grad-date-from');
  const t = document.getElementById('grad-date-to');
  if (f) f.value = '';
  if (t) t.value = '';
  renderGraduated();
}

function exportGraduatedPdf() {
  if (!allGraduated.length) { alert('No graduated members to export.'); return; }

  const search   = (document.getElementById('member-search')?.value || '').toLowerCase();
  const fromDate = document.getElementById('grad-date-from')?.value || '';
  const toDate   = document.getElementById('grad-date-to')?.value || '';
  let rows = allGraduated;
  if (graduatedLevelFilter !== 'all') rows = rows.filter(r => String(r.from_level) === graduatedLevelFilter);
  if (search)   rows = rows.filter(r => r.name.toLowerCase().includes(search) || r.family.toLowerCase().includes(search));
  if (fromDate) rows = rows.filter(r => r.graduated_at && r.graduated_at >= fromDate);
  if (toDate)   rows = rows.filter(r => r.graduated_at && r.graduated_at <= toDate);
  if (!rows.length) { alert('No records match the current filter.'); return; }

  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const gold  = [200, 169, 110];
  const navy  = [9, 13, 23];
  const gray  = [120, 139, 160];

  // ── Header banner (same as other reports) ──
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 36, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...gold);
  doc.text('AWM / ZTCC', 14, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 200, 200);
  doc.text('Discipleship Class', 14, 19);
  const lvlTitle = graduatedLevelFilter !== 'all' ? 'Graduated — Level ' + graduatedLevelFilter : 'Graduated Members';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text(lvlTitle, 14, 29);
  const genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 180);
  doc.text('Generated: ' + genDate, pageW - 14, 29, { align: 'right' });

  let nextY = 42;

  // ── Stats row ──
  const byLevel = {};
  rows.forEach(r => { byLevel[r.from_level] = (byLevel[r.from_level] || 0) + 1; });
  const stats = [
    { label: 'Total Graduated', value: String(rows.length) },
    { label: 'From Level 1',    value: String(byLevel[1] || 0) },
    { label: 'From Level 2',    value: String(byLevel[2] || 0) },
    { label: 'From Level 3',    value: String(byLevel[3] || 0) },
  ];
  const boxW = (pageW - 28 - 12) / 4;
  stats.forEach((s, i) => {
    const x = 14 + i * (boxW + 4);
    doc.setFillColor(240, 242, 245);
    doc.roundedRect(x, nextY, boxW, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...navy);
    doc.text(s.value, x + boxW / 2, nextY + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...gray);
    doc.text(s.label.toUpperCase(), x + boxW / 2, nextY + 15, { align: 'center' });
  });
  nextY += 24;

  // ── Date filter note ──
  const notes = [];
  if (fromDate && toDate) notes.push('Graduated ' + fromDate + ' to ' + toDate);
  else if (fromDate) notes.push('Graduated from ' + fromDate);
  else if (toDate)   notes.push('Graduated up to ' + toDate);
  if (search) notes.push('Search: "' + search + '"');
  if (notes.length) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...gray);
    doc.text('Filtered — ' + notes.join(' · '), 14, nextY);
    nextY += 6;
  }

  // ── Table ──
  doc.autoTable({
    startY: nextY,
    head: [['#', 'Name', 'Family', 'Graduated From', 'Graduated On', 'Now In']],
    body: rows.map((r, i) => [
      i + 1,
      r.name,
      r.family || '—',
      'Level ' + r.from_level,
      r.graduated_at ? new Date(r.graduated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
      r.current_level ? 'Level ' + r.current_level : '—'
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: navy, textColor: gold, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 249, 251] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Footer on every page ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...navy);
    doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageW, 10, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...gold);
    doc.text('AWM / ZTCC — Discipleship Class', 14, doc.internal.pageSize.getHeight() - 3.5);
    doc.setTextColor(180, 180, 180);
    doc.text('Page ' + i + ' of ' + pageCount, pageW - 14, doc.internal.pageSize.getHeight() - 3.5, { align: 'right' });
  }

  const lvlLabel  = graduatedLevelFilter !== 'all' ? '_level' + graduatedLevelFilter : '';
  const dateLabel = fromDate ? '_' + fromDate : '';
  doc.save('graduated_members' + lvlLabel + dateLabel + '_' + new Date().toISOString().split('T')[0] + '.pdf');
}

// Wire search to graduated view too
document.addEventListener('DOMContentLoaded', () => {
  const s = document.getElementById('member-search');
  if (s) s.addEventListener('input', () => { if (memberView === 'graduated') renderGraduated(); });
});

// ════════════════════════════════════

function openAddMemberModal() { openMemberModal(); }

function openMemberModal() {
  document.getElementById('modal-title').textContent   = 'Add Member';
  document.getElementById('modal-member-id').value     = '';
  document.getElementById('modal-name').value          = '';
  document.getElementById('modal-family').value        = '';
  document.getElementById('modal-phone').value         = '';
  document.getElementById('member-modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 100);
}

function openEditModal(member) {
  document.getElementById('modal-title').textContent   = 'Edit Member';
  document.getElementById('modal-member-id').value     = member.id;
  document.getElementById('modal-name').value          = member.full_name || '';
  document.getElementById('modal-family').value        = member.family_name || '';
  document.getElementById('modal-phone').value         = member.phone_number || '';
  document.getElementById('member-modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 100);
}

function closeModal() {
  document.getElementById('member-modal').classList.remove('open');
}

async function saveMember() {
  const id     = document.getElementById('modal-member-id').value;
  const name   = document.getElementById('modal-name').value.trim();
  const family = document.getElementById('modal-family').value.trim();
  const phone  = document.getElementById('modal-phone').value.trim();
  if (!name) { alert('Name is required'); return; }
  const body = { full_name: name, family_name: family || null, phone_number: phone || null };
  try {
    if (id) {
      await api(`people?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      // New member inherits the currently active level
      await api('people', { method: 'POST', body: JSON.stringify({ ...body, current_level_id: selectedLevel }) });
    }
    closeModal();
    loadMembers();
  } catch(e) {
    alert('Error saving member: ' + e.message);
  }
}

// ════════════════════════════════════
// BULK MEMBER UPLOAD
// ════════════════════════════════════

let bulkRows = [];

function openBulkUploadModal() {
  clearBulkFile();
  document.getElementById('bulk-upload-modal').classList.add('open');
}

function closeBulkUploadModal() {
  document.getElementById('bulk-upload-modal').classList.remove('open');
  clearBulkFile();
}

function clearBulkFile() {
  bulkRows = [];
  const fileInput = document.getElementById('bulk-file-input');
  if (fileInput) fileInput.value = '';
  const preview = document.getElementById('bulk-preview');
  if (preview) preview.style.display = 'none';
  const status = document.getElementById('bulk-status');
  if (status) { status.textContent = ''; status.style.color = ''; }
  const btn = document.getElementById('bulk-submit-btn');
  if (btn) btn.disabled = true;
}

function downloadCsvTemplate(e) {
  e.preventDefault();
  const csv = 'full_name,family_name,phone_number\nJohn Smith,Smith Family,+1 234 567 8900\nJane Doe,,';
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'members_template.csv';
  a.click();
}

function handleBulkDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) parseBulkCsv(file);
}

function handleBulkFileSelect(e) {
  const file = e.target.files[0];
  if (file) parseBulkCsv(file);
}

function parseBulkCsv(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    setBulkStatus('Please upload a .csv file.', 'error'); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { setBulkStatus('File appears empty or has no data rows.', 'error'); return; }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const nameIdx   = headers.indexOf('full_name');
    const familyIdx = headers.indexOf('family_name');
    const phoneIdx  = headers.indexOf('phone_number');

    if (nameIdx === -1) { setBulkStatus('Missing required column: full_name', 'error'); return; }

    bulkRows = [];
    const errors = [];
    lines.slice(1).forEach((line, i) => {
      if (!line.trim()) return;
      // simple CSV parse — handles quoted fields
      const cols = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || line.split(',');
      const clean = cols.map(c => (c || '').trim().replace(/^"|"$/g, '').trim());
      const name = clean[nameIdx] || '';
      if (!name) { errors.push(`Row ${i + 2}: missing name`); return; }
      bulkRows.push({
        full_name:    name,
        family_name:  familyIdx >= 0 ? (clean[familyIdx] || null) : null,
        phone_number: phoneIdx  >= 0 ? (clean[phoneIdx]  || null) : null,
      });
    });

    if (bulkRows.length === 0) { setBulkStatus('No valid rows found.', 'error'); return; }

    // Render preview
    const tbody = document.getElementById('bulk-preview-body');
    tbody.innerHTML = bulkRows.map(r => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid var(--border);">${r.full_name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid var(--border);color:var(--text-muted);">${r.family_name || '—'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid var(--border);color:var(--text-muted);">${r.phone_number || '—'}</td>
      </tr>`).join('');
    document.getElementById('bulk-preview-title').textContent = `${bulkRows.length} member${bulkRows.length !== 1 ? 's' : ''} ready to import`;
    document.getElementById('bulk-preview').style.display = 'block';
    document.getElementById('bulk-submit-btn').disabled = false;

    if (errors.length) setBulkStatus(`${errors.length} row(s) skipped: ${errors.join('; ')}`, 'warn');
    else setBulkStatus('', '');
  };
  reader.readAsText(file);
}

function setBulkStatus(msg, type) {
  const el = document.getElementById('bulk-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'error' ? '#ef4444' : type === 'warn' ? 'var(--gold)' : '#4caf7d';
}

async function submitBulkUpload() {
  if (!bulkRows.length) return;
  const btn = document.getElementById('bulk-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Importing…';
  setBulkStatus('', '');

  const records = bulkRows.map(r => ({ ...r, current_level_id: selectedLevel }));

  // Insert in batches of 50
  const BATCH = 50;
  let inserted = 0, skipped = 0;
  try {
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      await api('people', {
        method: 'POST',
        body: JSON.stringify(batch)
      });
      inserted += batch.length;
    }
    setBulkStatus(`✓ ${inserted} members imported successfully.`, 'ok');
    btn.textContent = 'Done';
    loadMembers();
    setTimeout(() => closeBulkUploadModal(), 1500);
  } catch(e) {
    setBulkStatus('Import failed: ' + (e.message || 'Unknown error'), 'error');
    btn.disabled = false;
    btn.textContent = 'Import Members';
  }
}

document.addEventListener('click', e => {
  if (e.target === document.getElementById('bulk-upload-modal')) closeBulkUploadModal();
});

// ════════════════════════════════════

let deleteId = null;
function openDeleteModal(id, name) {
  deleteId = id;
  document.getElementById('delete-name').textContent = name;
  document.getElementById('delete-modal').classList.add('open');
}
function closeDeleteModal() {
  document.getElementById('delete-modal').classList.remove('open');
  deleteId = null;
}
async function confirmDelete() {
  if (!deleteId) return;
  await api(`check_ins?person_id=eq.${deleteId}`, { method: 'DELETE' });
  await api(`people?id=eq.${deleteId}`, { method: 'DELETE' });
  closeDeleteModal();
  loadMembers();
}

// ── MEMBER ATTENDANCE HISTORY ──
async function viewMemberAttendance(id, name) {
  document.getElementById('history-modal-name').textContent = name;
  document.getElementById('history-modal-meta').textContent = 'Loading…';
  document.getElementById('history-list').innerHTML = '<div style="text-align:center;padding:24px;color:#7a8ba0;"><span class="spinner"></span></div>';
  document.getElementById('history-modal').classList.add('open');

  try {
    const [allSessions, checkIns] = await Promise.all([
      api('sessions?select=id,session_date,title&order=session_date.desc&limit=500&level_id=eq.' + selectedLevel),
      api('check_ins?person_id=eq.' + id + '&select=session_id,checked_in_at&limit=500')
    ]);

    if (!allSessions || allSessions.length === 0) {
      document.getElementById('history-modal-meta').textContent = 'No sessions recorded yet.';
      document.getElementById('history-list').innerHTML = '<div style="text-align:center;padding:32px;color:#7a8ba0;font-size:14px;">No sessions found.</div>';
      return;
    }

    const ciMap    = {};
    (checkIns || []).forEach(ci => { ciMap[ci.session_id] = ci.checked_in_at; });
    const attended = Object.keys(ciMap).length;
    const total    = allSessions.length;
    document.getElementById('history-modal-meta').textContent =
      `${attended} attended · ${total - attended} absent · ${total} total sessions`;

    document.getElementById('history-list').innerHTML = allSessions.map((s, i) => {
      const present  = !!ciMap[s.id];
      const date     = new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      const timeStr  = present
        ? `Checked in at ${new Date(ciMap[s.id]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
        : 'Did not attend';
      const badge    = present
        ? `<span style="background:rgba(76,175,125,0.15);color:#4caf7d;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;white-space:nowrap;">Present</span>`
        : `<span style="background:rgba(239,68,68,0.1);color:#ef4444;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;white-space:nowrap;">Absent</span>`;
      const numColor     = present ? 'rgba(200,169,110,0.12)' : 'rgba(239,68,68,0.08)';
      const numTextColor = present ? '#c8a96e' : '#ef4444';
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--border);">
          <div style="width:28px;height:28px;background:${numColor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${numTextColor};flex-shrink:0;">${total - i}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:var(--text);">${s.title || 'Discipleship Class'}</div>
            <div style="font-size:12px;color:var(--text-muted);">${date} · ${timeStr}</div>
          </div>
          ${badge}
        </div>`;
    }).join('');
  } catch(e) {
    document.getElementById('history-modal-meta').textContent = '';
    document.getElementById('history-list').innerHTML = `<div style="text-align:center;padding:32px;color:#ef4444;font-size:14px;">Error: ${e.message}</div>`;
  }
}

function closeHistoryModal() {
  document.getElementById('history-modal').classList.remove('open');
}
document.getElementById('history-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('history-modal')) closeHistoryModal();
});

// ── SESSIONS MODAL ──
async function showSessionsModal() {
  document.getElementById('sessions-modal').classList.add('open');
  const list = document.getElementById('sessions-list');
  const meta = document.getElementById('sessions-modal-meta');

  let sessions = reportSessions;
  if (!sessions.length) {
    list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);"><span class="spinner"></span></div>';
    sessions = await api('sessions?select=id,session_date,title&order=session_date.desc&limit=500') || [];
    reportSessions = sessions;
  }

  if (!sessions.length) {
    meta.textContent = '';
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:14px;">No sessions recorded yet.</div>';
    return;
  }

  meta.textContent = `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`;
  list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);"><span class="spinner"></span></div>';

  const counts = await Promise.all(
    sessions.map(s => api(`check_ins?session_id=eq.${s.id}&select=person_id`).then(r => r ? r.length : 0))
  );

  list.innerHTML = sessions.map((s, i) => {
    const date = new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    return `
      <div onclick="goToSessionAttendance('${s.session_date}')" style="display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:6px;transition:background 0.15s;" onmouseover="this.style.background='rgba(200,169,110,0.06)'" onmouseout="this.style.background=''">
        <div style="width:28px;height:28px;background:rgba(200,169,110,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--gold);flex-shrink:0;">${sessions.length - i}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--gold);">${s.title || 'Discipleship Class'}</div>
          <div style="font-size:12px;color:var(--text-muted);">${date}</div>
        </div>
        <span style="background:rgba(76,175,125,0.15);color:#4caf7d;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;white-space:nowrap;">${counts[i]} present</span>
      </div>`;
  }).join('');
}

function closeSessionsModal() {
  document.getElementById('sessions-modal').classList.remove('open');
}
function goToSessionAttendance(date) {
  closeSessionsModal();
  document.getElementById('attendance-date').value = date;
  showPage('attendance');
  loadAttendanceForDate();
}
document.getElementById('sessions-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('sessions-modal')) closeSessionsModal();
});

// ── MANUAL ENTRY ──
let manualMembers  = [];
let manualSelected = new Set();
let uploadMatches  = [];

function switchManualTab(tab) {
  document.getElementById('tab-select').style.display = tab === 'select' ? 'block' : 'none';
  document.getElementById('tab-upload').style.display = tab === 'upload' ? 'block' : 'none';
  document.getElementById('tab-select-btn').classList.toggle('active', tab === 'select');
  document.getElementById('tab-upload-btn').classList.toggle('active', tab === 'upload');
}

async function initManualEntry() {
  const todayISO = new Date().toISOString().split('T')[0];
  document.getElementById('manual-date').value = todayISO;
  document.getElementById('upload-date').value = todayISO;

  // Always reload so it reflects the currently selected level
  manualMembers = await api('people?order=full_name&limit=1000&current_level_id=eq.' + selectedLevel) || [];
  manualSelected.clear();
  renderManualGrid(manualMembers);
  updateManualCount();
}

function renderManualGrid(members) {
  const grid = document.getElementById('manual-member-grid');
  if (!members.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#7a8ba0;">No members found</div>';
    return;
  }
  grid.innerHTML = members.map(m => `
    <div class="member-check-card ${manualSelected.has(m.id) ? 'checked' : ''}" onclick="toggleManualMember('${m.id}')" data-id="${m.id}">
      <div class="mcheck">
        ${manualSelected.has(m.id) ? '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' : ''}
      </div>
      <div>
        <div class="mname">${m.full_name}</div>
        <div class="mfam">${m.family_name || 'No family'}</div>
      </div>
    </div>`).join('');
}

function filterManualMembers() {
  const q = document.getElementById('manual-filter').value.toLowerCase();
  const filtered = manualMembers.filter(m =>
    m.full_name.toLowerCase().includes(q) || (m.family_name || '').toLowerCase().includes(q)
  );
  renderManualGrid(filtered);
}

function toggleManualMember(id) {
  if (manualSelected.has(id)) manualSelected.delete(id);
  else manualSelected.add(id);
  const card = document.querySelector(`.member-check-card[data-id="${id}"]`);
  if (card) {
    card.classList.toggle('checked', manualSelected.has(id));
    card.querySelector('.mcheck').innerHTML = manualSelected.has(id)
      ? '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
      : '';
  }
  updateManualCount();
}

function selectAllManual() {
  const q = document.getElementById('manual-filter').value.toLowerCase();
  const visible = manualMembers.filter(m =>
    m.full_name.toLowerCase().includes(q) || (m.family_name || '').toLowerCase().includes(q)
  );
  visible.forEach(m => manualSelected.add(m.id));
  renderManualGrid(visible.length < manualMembers.length ? visible : manualMembers);
  updateManualCount();
}

function clearManualSelection() {
  manualSelected.clear();
  filterManualMembers();
  updateManualCount();
}

function updateManualCount() {
  const n   = manualSelected.size;
  document.getElementById('manual-select-count').textContent = `${n} member${n !== 1 ? 's' : ''} selected`;
  const btn = document.getElementById('manual-submit-btn');
  btn.disabled    = n === 0;
  btn.textContent = n > 0 ? `Record Attendance (${n})` : 'Record Attendance';
}

async function submitManualAttendance() {
  const date = document.getElementById('manual-date').value;
  if (!date) { alert('Please select a session date.'); return; }
  if (manualSelected.size === 0) return;

  const btn = document.getElementById('manual-submit-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const session   = await getOrCreateSession(date);
    const existing  = await api(`check_ins?session_id=eq.${session.id}&select=person_id`);
    const existingIds = new Set((existing || []).map(c => c.person_id));
    const toInsert  = [...manualSelected].filter(id => !existingIds.has(id));

    if (toInsert.length > 0) {
      await api('check_ins', {
        method: 'POST',
        body: JSON.stringify(toInsert.map(id => ({ session_id: session.id, person_id: id })))
      });
    }

    const skipped = manualSelected.size - toInsert.length;
    alert(`✅ Recorded ${toInsert.length} attendance${toInsert.length !== 1 ? 's' : ''} for ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}.${skipped > 0 ? `\n${skipped} were already recorded.` : ''}`);
    manualSelected.clear();
    renderManualGrid(manualMembers);
    updateManualCount();
  } catch(e) {
    alert('Error: ' + e.message);
  } finally {
    btn.disabled = false;
    updateManualCount();
  }
}

async function getOrCreateSession(date) {
  const existing = await api('sessions?session_date=eq.' + date + '&level_id=eq.' + selectedLevel + '&limit=1');
  if (existing && existing.length > 0) return existing[0];
  await api('sessions', { method: 'POST', body: JSON.stringify({ session_date: date, title: 'Discipleship Class', level_id: selectedLevel }) });
  const created = await api('sessions?session_date=eq.' + date + '&level_id=eq.' + selectedLevel + '&limit=1');
  return created[0];
}

// ── TEMPLATE UPLOAD ──
function downloadTemplate() {
  if (manualMembers.length === 0) { alert('Members not loaded yet. Please try again.'); return; }
  const rows = [['Full Name', 'Family Group', 'Present (YES/NO)']];
  manualMembers.forEach(m => rows.push([m.full_name, m.family_name || '', '']));
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `attendance_template_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) processUploadFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processUploadFile(file);
  e.target.value = '';
}

async function processUploadFile(file) {
  if (manualMembers.length === 0) manualMembers = await api('people?order=full_name&limit=1000') || [];

  const ext = file.name.split('.').pop().toLowerCase();
  let rows  = [];

  if (ext === 'csv') {
    const text = await file.text();
    rows = text.split('\n').map(r => r.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
  } else if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') { alert('Excel parser not loaded. Please use a CSV file instead.'); return; }
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type: 'array' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_array(ws);
  } else {
    alert('Please upload a .csv or .xlsx file.');
    return;
  }

  if (rows.length < 2) { alert('File appears to be empty or has no data rows.'); return; }

  const header    = rows[0].map(h => h.toLowerCase());
  const nameCol   = header.findIndex(h => h.includes('name'));
  const presentCol = header.findIndex(h => h.includes('present') || h.includes('attend'));
  if (nameCol === -1) { alert('Could not find a "Name" column in the file.'); return; }

  const nameMap = {};
  manualMembers.forEach(m => { nameMap[m.full_name.toLowerCase()] = m; });

  uploadMatches = [];
  rows.slice(1).forEach(row => {
    if (!row[nameCol] || !row[nameCol].trim()) return;
    const rawName = row[nameCol].trim();
    const present = presentCol !== -1 ? /^yes$/i.test((row[presentCol] || '').trim()) : true;
    const member  = nameMap[rawName.toLowerCase()] || null;
    uploadMatches.push({ rawName, member, present });
  });

  const presentCount = uploadMatches.filter(r => r.present && r.member).length;
  document.getElementById('upload-preview').style.display = 'block';
  document.getElementById('upload-preview-title').textContent =
    `${uploadMatches.length} rows found — ${presentCount} matched & present`;
  document.getElementById('upload-submit-btn').disabled = presentCount === 0;

  document.getElementById('upload-preview-body').innerHTML = uploadMatches.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.rawName}</td>
      <td class="${r.member ? 'match-ok' : 'match-no'}">${r.member ? r.member.full_name : 'Not found'}</td>
      <td>${r.present
        ? (r.member
          ? '<span style="background:rgba(76,175,125,0.15);color:#4caf7d;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">Present</span>'
          : '<span style="background:rgba(200,169,110,0.12);color:#c8a96e;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">No match</span>')
        : '<span style="background:rgba(255,255,255,0.05);color:#7a8ba0;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">Absent</span>'
      }</td>
    </tr>`).join('');
}

async function submitUploadAttendance() {
  const date = document.getElementById('upload-date').value;
  if (!date) { alert('Please select a session date.'); return; }
  const toRecord = uploadMatches.filter(r => r.present && r.member);
  if (toRecord.length === 0) { alert('No matched present members to record.'); return; }

  const btn = document.getElementById('upload-submit-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const session     = await getOrCreateSession(date);
    const existing    = await api(`check_ins?session_id=eq.${session.id}&select=person_id`);
    const existingIds = new Set((existing || []).map(c => c.person_id));
    const seen        = new Set();
    const inserts     = toRecord
      .filter(r => !existingIds.has(r.member.id) && !seen.has(r.member.id) && seen.add(r.member.id))
      .map(r => ({ session_id: session.id, person_id: r.member.id }));

    if (inserts.length > 0) {
      await api('check_ins', { method: 'POST', body: JSON.stringify(inserts) });
    }

    const skipped = toRecord.length - inserts.length;
    alert(`✅ Recorded ${inserts.length} attendance${inserts.length !== 1 ? 's' : ''} from upload.${skipped > 0 ? `\n${skipped} were already recorded.` : ''}`);
    document.getElementById('upload-preview').style.display = 'none';
    uploadMatches = [];
  } catch(e) {
    alert('Error: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Record Attendance';
  }
}

// ── QR CODE ──
async function renderQR() {
  const today = new Date().toISOString().split('T')[0];
  let sessionParam = '';
  try {
    const session = await getOrCreateSession(today);
    if (session && session.id) sessionParam = `?session=${session.id}`;
  } catch(e) { /* fall back to no param */ }
  const url = `${SITE_URL}/attendance/${sessionParam}`;
  document.getElementById('qr-url-text').textContent = url;
  drawQR(url);
}

function drawQR(text) {
  const canvas = document.getElementById('qr-canvas');
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, 240, 240);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(text)}`;
  img.onload  = () => ctx.drawImage(img, 0, 0, 240, 240);
  img.onerror = () => {
    ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, 0, 240, 240);
    ctx.fillStyle = '#6b7280'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('QR Code', 120, 115);
    ctx.fillText('(requires internet)', 120, 135);
  };
}

function printQR() {
  const url = document.getElementById('qr-url-text').textContent;
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>QR Code — Discipleship Attendance</title>
    <style>body{font-family:sans-serif;text-align:center;padding:40px}</style></head>
    <body>
      <h2 style="font-family:Georgia,serif;">✝ Discipleship Class — Attendance</h2>
      <p style="color:#7a8ba0;margin-bottom:20px;">Scan this QR code to check in</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}" />
      <p style="margin-top:16px;font-size:12px;color:#7a8ba0;">${url}</p>
      <script>window.onload = () => window.print();<\/script>
    </body></html>`);
}

async function openAttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  let sessionParam = '';
  try {
    const session = await getOrCreateSession(today);
    if (session && session.id) sessionParam = `?session=${session.id}`;
  } catch(e) { /* fall back */ }
  const url = `${SITE_URL}/attendance/${sessionParam}`;
  window.open(url, '_blank');
}

// ── MODAL OVERLAY CLOSE ──
document.getElementById('member-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('member-modal')) closeModal();
});
document.getElementById('delete-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
});
