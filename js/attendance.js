/* ═══════════════════════════════════════════════════════════
   ATTENDANCE.JS — member self-check-in page logic
   Depends on: config.js · api.js · theme.js
   ═══════════════════════════════════════════════════════════ */

// ── Date helpers ──
const todayISO   = new Date().toISOString().split('T')[0];
const todayLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
document.getElementById('header-date').textContent = todayLabel;

// ── State ──
let mode            = 'search'; // 'search' | 'browse'
let searchQuery     = '';
let selectedFamily  = null;
let selectedMember  = null;  // { id, name, family, phone, level, totalSessions?, attended? }

const LEVEL_NAMES = { 1: 'Level 1', 2: 'Level 2', 3: 'Level 3 — S.H.A.P.E' };
let justSubmitted   = null;
let currentSession  = null;
let todayCheckedInIds = new Set();
let familyList      = [];
let familyMembers   = [];
let searchTimer     = null;
let lastSearchResults = [];

// ── HTML escape ──
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ════════════════════════════════════
// RENDER
// ════════════════════════════════════

function render() {
  const main = document.getElementById('main');
  if (justSubmitted) { renderSuccess(main); return; }
  main.innerHTML = `
    <div class="date-pill">📅 ${esc(todayLabel)}</div>
    <div class="card" id="checkin-card">
      ${selectedMember ? renderChip() + renderSubmit() : renderPicker()}
    </div>`;
  wire();
}

function renderPicker() {
  return `
    <div class="seg">
      <button class="${mode === 'search' ? 'active' : ''}" data-mode="search">Search name</button>
      <button class="${mode === 'browse' ? 'active' : ''}" data-mode="browse">Browse by family</button>
    </div>
    ${mode === 'search' ? renderSearch() : renderBrowse()}`;
}

function renderSearch() {
  const q = searchQuery.trim();
  return `
    <label class="field-label" for="search-input">Find your name</label>
    <input type="text" id="search-input" value="${esc(searchQuery)}" autocomplete="off" />
    <div class="result-list" id="result-list">
      ${q.length === 0 ? '' : '<div class="spinner"></div>'}
    </div>`;
}

function renderBrowse() {
  const familyOptions = familyList.map(f =>
    `<option value="${esc(f)}" ${f === selectedFamily ? 'selected' : ''}>${esc(f)}</option>`
  ).join('');

  let memberRows = '';
  if (selectedFamily && familyMembers.length > 0) {
    memberRows = familyMembers.map(m => `
      <div class="result-item" data-id="${esc(m.id)}">
        <span class="nm">${esc(m.full_name)}</span>
      </div>`).join('');
  } else if (selectedFamily && familyMembers.length === 0) {
    memberRows = '<div class="no-results">No members in this family.</div>';
  }

  return `
    <label class="field-label">Select your family</label>
    <select id="family-select">
      <option value="">Choose a family…</option>
      ${familyOptions}
    </select>
    ${selectedFamily ? `
      <label class="field-label" style="margin-top:16px;">Select your name</label>
      <div class="result-list" style="max-height:280px;" id="family-members">
        ${familyMembers.length === 0
          ? '<div class="spinner"></div>'
          : memberRows}
      </div>` : ''}`;
}

function renderChip() {
  const alreadyIn = todayCheckedInIds.has(selectedMember.id);
  return `
    <label class="field-label">Selected</label>
    <div class="selected-chip">
      <div class="info">
        <div class="nm">${esc(selectedMember.name)}</div>
        ${alreadyIn ? '<div class="fam"><span style="color:var(--rust);">Already checked in</span></div>' : ''}
      </div>
      <button id="change-btn">Change</button>
    </div>`;
}

function renderSubmit() {
  const alreadyIn    = todayCheckedInIds.has(selectedMember.id);
  const inactive     = selectedMember.isActive === false;
  const sessionLevel = currentSession && currentSession.level_id;
  const wrongLevel   = sessionLevel && selectedMember.level && selectedMember.level !== sessionLevel;
  const blocked      = alreadyIn || inactive || wrongLevel;

  // Populate stats block once data is ready
  if (selectedMember.totalSessions !== undefined) {
    setTimeout(() => {
      const el = document.getElementById('member-stats-block');
      if (el) renderMemberStatsBlock(el, selectedMember.attended, selectedMember.totalSessions);
    }, 0);
  }

  let blockMessage = '';
  if (wrongLevel) {
    const sessionLevelName = LEVEL_NAMES[sessionLevel] || ('Level ' + sessionLevel);
    const memberLevelName  = LEVEL_NAMES[selectedMember.level] || ('Level ' + selectedMember.level);
    blockMessage = `<p class="hint" style="color:var(--rust);margin-top:8px;">
      This session is for <strong>${esc(sessionLevelName)}</strong>. You are enrolled in <strong>${esc(memberLevelName)}</strong>. Please use the correct coordinator's QR code.
    </p>`;
  } else if (inactive) {
    blockMessage = `<p class="hint" style="color:var(--rust);margin-top:8px;">This member is inactive and cannot check in.</p>`;
  }

  return `
    <label class="field-label" style="margin-top:4px;">Family</label>
    <input type="text" value="${esc(selectedMember.family || '—')}" disabled style="opacity:1;cursor:default;" />
    <label class="field-label" style="margin-top:14px;">Level</label>
    <input type="text" value="${esc(LEVEL_NAMES[selectedMember.level] || (selectedMember.level ? 'Level ' + selectedMember.level : '—'))}" disabled style="opacity:1;cursor:default;" />
    <label class="field-label" for="phone-input" style="margin-top:14px;">Phone Number</label>
    <input type="tel" id="phone-input" inputmode="tel"
           value="${esc(selectedMember.phone || '')}" ${blocked ? 'disabled' : ''} />
    ${blockMessage}
    <button class="btn btn-primary" id="submit-btn" style="margin-top:16px;" ${blocked ? 'disabled' : ''}>
      ${wrongLevel ? 'Wrong level' : inactive ? 'Member inactive' : alreadyIn ? 'Already recorded today' : 'Submit attendance'}
    </button>
    <p class="hint" id="submit-hint">&nbsp;</p>
    <div id="member-stats-block"></div>`;
}

function renderSuccess(main) {
  const attended  = justSubmitted.attended      ?? 0;
  const total     = justSubmitted.totalSessions ?? 0;
  const rate      = total > 0 ? Math.round(attended / total * 100) : 0;
  const rateColor = rate >= 75 ? '#4caf7d' : rate >= 40 ? 'var(--gold)' : '#ef4444';

  const statsHtml = total > 0 ? `
    <div style="margin-top:22px;padding-top:18px;border-top:1px solid var(--border);">
      <p style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Your Attendance</p>
      <div style="display:flex;justify-content:center;gap:28px;margin-bottom:14px;">
        <div style="text-align:center;">
          <div style="font-size:26px;font-weight:800;color:var(--gold);">${attended}/${total}</div>
          <div style="font-size:11px;color:var(--text-muted);">Sessions attended</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:26px;font-weight:800;color:${rateColor};">${rate}%</div>
          <div style="font-size:11px;color:var(--text-muted);">Attendance rate</div>
        </div>
      </div>
      <div style="background:var(--surface-2);border-radius:999px;height:8px;overflow:hidden;">
        <div style="height:100%;width:${rate}%;background:${rateColor};border-radius:999px;transition:width 0.8s ease;"></div>
      </div>
    </div>` : '';

  main.innerHTML = `
    <div class="card success-wrap">
      <div class="seal">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#090d17" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h2>You're marked present</h2>
      <p>${esc(justSubmitted.name)}</p>
      <p style="font-size:12.5px;">${esc(todayLabel)}</p>
      <span class="fam-tag">${esc(justSubmitted.family || '—')}</span>
      ${statsHtml}
    </div>
    <div class="card" style="margin-top:16px;">
      <button class="btn btn-ghost" id="another-btn">Check in someone else</button>
    </div>`;

  document.getElementById('another-btn').onclick = () => {
    justSubmitted  = null;
    selectedMember = null;
    selectedFamily = null;
    searchQuery    = '';
    familyMembers  = [];
    render();
  };
}

// ════════════════════════════════════
// STATS BLOCK
// ════════════════════════════════════

function renderMemberStatsBlock(el, attended, total) {
  if (!total || total === 0) { el.innerHTML = ''; return; }
  attended = attended || 0;
  const rate      = Math.round(attended / total * 100);
  const rateColor = rate >= 75 ? '#4caf7d' : rate >= 40 ? 'var(--gold)' : '#ef4444';
  el.innerHTML = `
    <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border);">
      <p style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Your Attendance</p>
      <div style="display:flex;justify-content:center;gap:28px;margin-bottom:12px;">
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:800;color:var(--gold);">${attended}/${total}</div>
          <div style="font-size:11px;color:var(--text-muted);">Sessions attended</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:800;color:${rateColor};">${rate}%</div>
          <div style="font-size:11px;color:var(--text-muted);">Attendance rate</div>
        </div>
      </div>
      <div style="background:var(--surface-2);border-radius:999px;height:8px;overflow:hidden;">
        <div style="height:100%;width:${rate}%;background:${rateColor};border-radius:999px;transition:width 0.8s ease;"></div>
      </div>
    </div>`;
}

async function fetchMemberStats(memberId) {
  try {
    const [allSessions, memberCIs] = await Promise.all([
      api('sessions?select=id&limit=1000'),
      api(`check_ins?person_id=eq.${memberId}&select=session_id&limit=1000`)
    ]);
    if (selectedMember && selectedMember.id === memberId) {
      selectedMember.totalSessions = (allSessions || []).length;
      selectedMember.attended      = (memberCIs  || []).length;
      const statsEl = document.getElementById('member-stats-block');
      if (statsEl) renderMemberStatsBlock(statsEl, selectedMember.attended, selectedMember.totalSessions);
    }
  } catch(e) { /* silent */ }
}

// ════════════════════════════════════
// EVENT WIRING
// ════════════════════════════════════

function wire() {
  // Tab switch
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.onclick = () => {
      mode           = btn.dataset.mode;
      selectedFamily = null;
      searchQuery    = '';
      familyMembers  = [];
      render();
    };
  });

  // Search input
  const si = document.getElementById('search-input');
  if (si) {
    si.oninput = e => {
      searchQuery = e.target.value;
      clearTimeout(searchTimer);
      const q  = searchQuery.trim();
      const rl = document.getElementById('result-list');
      if (q.length < 4) { rl.innerHTML = ''; return; }
      rl.innerHTML = '<div class="spinner"></div>';
      searchTimer  = setTimeout(() => doSearch(q), 300);
    };
    si.focus();
    si.setSelectionRange(si.value.length, si.value.length);
  }

  // Family select
  const fs = document.getElementById('family-select');
  if (fs) {
    fs.onchange = async e => {
      selectedFamily = e.target.value || null;
      familyMembers  = [];
      render();
      if (selectedFamily) {
        familyMembers = await api(
          `people?family_name=eq.${encodeURIComponent(selectedFamily)}&order=full_name&select=id,full_name,family_name,phone_number,current_level_id,is_active`
        ) || [];
        const container = document.getElementById('family-members');
        if (container) {
          container.innerHTML = familyMembers.length > 0
            ? familyMembers.map(m =>
                `<div class="result-item" data-id="${esc(m.id)}"><span class="nm">${esc(m.full_name)}</span></div>`
              ).join('')
            : '<div class="no-results">No members found.</div>';
          wireResultItems();
        }
      }
    };
  }

  // Change button
  const cb = document.getElementById('change-btn');
  if (cb) cb.onclick = () => { selectedMember = null; render(); };

  // Submit button
  const sb = document.getElementById('submit-btn');
  if (sb) sb.onclick = handleSubmit;

  wireResultItems();
}

function wireResultItems() {
  document.querySelectorAll('.result-item').forEach(item => {
    item.onclick = () => {
      const id     = item.dataset.id;
      let member   = familyMembers.find(m => m.id === id);
      if (!member) member = lastSearchResults.find(m => m.id === id);
      if (member) {
        selectedMember = {
          id:            member.id,
          name:          member.full_name,
          family:        member.family_name,
          phone:         member.phone_number,
          level:         member.current_level_id,
          isActive:      member.is_active !== false,
          totalSessions: undefined,
          attended:      undefined
        };
        render();
        fetchMemberStats(selectedMember.id);
      }
    };
  });
}

// ════════════════════════════════════
// SEARCH
// ════════════════════════════════════

async function doSearch(q) {
  try {
    const data = await api(
      `people?full_name=ilike.%25${encodeURIComponent(q)}%25&select=id,full_name,family_name,phone_number,current_level_id,is_active&order=full_name&limit=8`
    );
    lastSearchResults = data || [];
    const rl = document.getElementById('result-list');
    if (!rl) return;
    if (!data || data.length === 0) {
      rl.innerHTML = `<div class="no-results">No name matches "${esc(q)}". Try Browse by family instead.</div>`;
      return;
    }
    rl.innerHTML = data.map(m => `
      <div class="result-item" data-id="${esc(m.id)}">
        <span class="nm">${esc(m.full_name)}</span>
        <span class="fam">${esc(m.family_name || '—')}</span>
      </div>`).join('');
    wireResultItems();
  } catch(e) {
    const rl = document.getElementById('result-list');
    if (rl) rl.innerHTML = '<div class="no-results">Error loading results.</div>';
  }
}

// ════════════════════════════════════
// SUBMIT
// ════════════════════════════════════

async function handleSubmit() {
  if (!selectedMember) return;
  const btn     = document.getElementById('submit-btn');
  const hint    = document.getElementById('submit-hint');
  const phoneEl = document.getElementById('phone-input');
  const phone   = phoneEl ? phoneEl.value.trim() : selectedMember.phone;

  if (!phone || phone.length < 6) {
    hint.textContent  = 'Please enter a valid phone number.';
    hint.style.color  = 'var(--rust)';
    return;
  }

  // Level mismatch guard
  if (currentSession && currentSession.level_id && selectedMember.level &&
      selectedMember.level !== currentSession.level_id) {
    const sessionLevelName = LEVEL_NAMES[currentSession.level_id] || ('Level ' + currentSession.level_id);
    const memberLevelName  = LEVEL_NAMES[selectedMember.level]    || ('Level ' + selectedMember.level);
    hint.textContent = `This session is for ${sessionLevelName}. You are enrolled in ${memberLevelName}.`;
    hint.style.color = 'var(--rust)';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Submitting…';

  try {
    // Get or use the session identified by URL param (set by coordinator's QR code)
    if (!currentSession) {
      const sessionIdParam = new URLSearchParams(window.location.search).get('session');
      if (sessionIdParam) {
        const sessions = await api(`sessions?id=eq.${sessionIdParam}&limit=1`);
        if (sessions && sessions.length > 0) currentSession = sessions[0];
      }
      if (!currentSession) {
        // Fallback: find today's session by date (no level filter — legacy / direct URL)
        let sessions = await api(`sessions?session_date=eq.${todayISO}&order=id&limit=1`);
        if (!sessions || sessions.length === 0) {
          await api('sessions', {
            method: 'POST',
            body:   JSON.stringify({ session_date: todayISO, title: 'Discipleship Class' })
          });
          sessions = await api(`sessions?session_date=eq.${todayISO}&order=id&limit=1`);
        }
        currentSession = sessions[0];
      }
    }

    if (!todayCheckedInIds.has(selectedMember.id)) {
      await api('check_ins', {
        method: 'POST',
        body:   JSON.stringify([{ session_id: currentSession.id, person_id: selectedMember.id }])
      });
      todayCheckedInIds.add(selectedMember.id);
    }

    // Fetch personal stats for success screen
    const [allSessions, memberCIs] = await Promise.all([
      api('sessions?select=id&limit=1000'),
      api(`check_ins?person_id=eq.${selectedMember.id}&select=session_id&limit=1000`)
    ]);
    const totalSessions = (allSessions || []).length;
    const attended      = (memberCIs  || []).length;

    justSubmitted  = { ...selectedMember, totalSessions, attended };
    selectedMember = null;
    render();

  } catch(e) {
    hint.textContent  = 'Something went wrong. Please try again.';
    hint.style.color  = 'var(--rust)';
    btn.disabled      = false;
    btn.textContent   = 'Submit Attendance';
  }
}

// ════════════════════════════════════
// INIT
// ════════════════════════════════════

async function init() {
  // Load unique family names for the browse tab
  try {
    const fams = await api('people?select=family_name&family_name=not.is.null&order=family_name') || [];
    familyList = [...new Set(fams.map(f => f.family_name))].sort();
  } catch(e) { familyList = []; }

  // Pre-load the session and existing check-ins.
  // Priority: ?session=ID in URL (from coordinator QR code) → date fallback
  try {
    const sessionIdParam = new URLSearchParams(window.location.search).get('session');
    let sessionToLoad = null;

    if (sessionIdParam) {
      const sessions = await api(`sessions?id=eq.${sessionIdParam}&limit=1`);
      if (sessions && sessions.length > 0) sessionToLoad = sessions[0];
    }

    if (!sessionToLoad) {
      const sessions = await api(`sessions?session_date=eq.${todayISO}&order=id&limit=1`);
      if (sessions && sessions.length > 0) sessionToLoad = sessions[0];
    }

    if (sessionToLoad) {
      currentSession = sessionToLoad;
      const cis = await api(`check_ins?session_id=eq.${currentSession.id}&select=person_id`);
      if (cis) cis.forEach(c => todayCheckedInIds.add(c.person_id));
    }
  } catch(e) { /* silent — session may not exist yet */ }

  render();
}

init().catch(() => render()); // safety net — always show the UI
