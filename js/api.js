/* ═══════════════════════════════════════════════════════════
   API.JS — unified Supabase REST fetch wrapper
   Depends on: config.js (SUPABASE_URL, SUPABASE_KEY)

   Usage:
     api('people?order=full_name')                  → GET
     api('check_ins', { method:'POST', body:… })    → POST/PATCH/DELETE

   Auth:
     The attendance page uses the anon key only.
     After admin login, call setAuthToken(jwt) so
     subsequent calls use the user's JWT token.
   ═══════════════════════════════════════════════════════════ */

let _authToken = null;

/** Called by admin.js after a successful Supabase auth login */
function setAuthToken(token) {
  _authToken = token;
}

function _buildHeaders() {
  return {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${_authToken || SUPABASE_KEY}`,
    'Content-Type':  'application/json'
  };
}

/**
 * Fetch a Supabase REST endpoint.
 * @param {string} path  - e.g. 'people?order=full_name'
 * @param {object} options - standard fetch options (method, body, headers…)
 * @returns {Promise<any>} parsed JSON or null for 204
 */
async function api(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ..._buildHeaders(), ...(extraHeaders || {}) },
    ...rest
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}

// Backward-compat alias used by attendance.js
const sbFetch = api;
