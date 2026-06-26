/* ═══════════════════════════════════════════════════════════
   THEME.JS — light/dark mode toggle
   Depends on: config.js (THEME_KEY)

   Works for both pages:
   - index.html  has a round emoji button  (#theme-toggle)
   - admin.html  has a sidebar button with
                 separate icon (#theme-icon) and label (#theme-label)
   ═══════════════════════════════════════════════════════════ */

/**
 * Apply a theme and update toggle button UI for whichever page is loaded.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  // Directly set sidebar + mobile topbar background so it updates
  // immediately regardless of any browser CSS caching
  const sidebarBg   = theme === 'light' ? '#1a2f5e' : '#070b14';
  const topbarBg    = theme === 'light' ? '#1a2f5e' : '';
  document.querySelectorAll('.sidebar').forEach(el => {
    el.style.background = sidebarBg;
  });
  const topbar = document.querySelector('.mobile-topbar');
  if (topbar) topbar.style.background = topbarBg;

  // Admin sidebar toggle (has separate icon + label spans)
  const icon  = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (icon)  icon.textContent  = theme === 'dark' ? '🌙' : '☀️';
  if (label) label.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';

  // Attendance page toggle (plain emoji button with no child spans)
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn && !icon) {
    toggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}

/** Toggle between dark and light, persist to localStorage */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next    = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

// Apply saved (or default dark) theme on every page load
applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
